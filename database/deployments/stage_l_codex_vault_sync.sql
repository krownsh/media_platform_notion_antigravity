-- Stage L: separate database-only preprocessing from local Claude-Obsidian sync.
--
-- A remote analysis client may prepare all safe workflow state without access
-- to the user's Mac filesystem. Such workflows wait in vault_sync/pending;
-- the Mac-side agent:vault-sync command writes the real note and then moves
-- the workflow to its recorded target stage/status.

begin;

alter table public.collection_post_workflows
    drop constraint if exists collection_post_workflows_stage_check;

alter table public.collection_post_workflows
    add constraint collection_post_workflows_stage_check
    check (stage in (
        'base_analysis', 'triage', 'preprocessing', 'vault_sync',
        'strategy', 'research', 'review', 'actions', 'complete'
    ));

comment on column public.collection_post_workflows.context is
    'Bounded workflow context. vault_sync stores a prepared note input and target stage until the real local Claude-Obsidian write completes.';

create index if not exists collection_post_workflows_vault_sync_idx
    on public.collection_post_workflows (available_at, created_at asc)
    where stage = 'vault_sync' and status in ('pending', 'failed');

create or replace function public.claim_collection_hermes_cron_workflow(
    p_agent_id text,
    p_lease_seconds integer default 1800,
    p_queue text default 'preprocess'
)
returns setof public.collection_post_workflows
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    lease public.collection_hermes_cron_leases;
    candidate public.collection_post_workflows;
    claimed public.collection_post_workflows;
    lease_seconds integer := greatest(60, least(coalesce(p_lease_seconds, 1800), 7200));
begin
    if p_agent_id is null or p_agent_id !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'Invalid Hermes Cron agent identity';
    end if;
    if coalesce(p_queue, 'preprocess') not in ('preprocess', 'research', 'vault_sync') then
        raise exception 'Invalid Hermes Cron queue';
    end if;

    select * into lease
    from public.collection_hermes_cron_leases
    where lease_id = 1
    for update;

    if lease.lease_id is null then
        insert into public.collection_hermes_cron_leases (lease_id)
        values (1)
        returning * into lease;
    end if;

    if lease.lease_expires_at is not null and lease.lease_expires_at > now() then
        return;
    end if;

    if lease.workflow_id is not null then
        update public.collection_post_workflows
        set status = 'failed',
            failed_stage = stage,
            last_error = left(coalesce(last_error, 'Hermes Cron lease expired before completion'), 4000),
            available_at = now(),
            locked_at = null,
            locked_by = null,
            updated_at = now()
        where id = lease.workflow_id
          and status = 'processing'
          and locked_by = lease.locked_by;
    end if;

    update public.collection_hermes_cron_leases
    set workflow_id = null,
        locked_by = null,
        locked_at = null,
        lease_expires_at = null,
        updated_at = now()
    where lease_id = 1;

    select workflow.* into candidate
    from public.collection_post_workflows workflow
    where workflow.status in ('pending', 'failed')
      and workflow.available_at <= now()
      and workflow.attempt_count < workflow.max_attempts
      and (workflow.locked_at is null
           or workflow.locked_at <= now() - make_interval(secs => lease_seconds))
      and (
          (coalesce(p_queue, 'preprocess') = 'preprocess'
           and workflow.stage in ('base_analysis', 'triage', 'preprocessing'))
          or
          (coalesce(p_queue, 'preprocess') = 'research'
           and workflow.stage = 'research')
          or
          (coalesce(p_queue, 'preprocess') = 'vault_sync'
           and workflow.stage = 'vault_sync')
      )
    order by
        case when workflow.status = 'failed' then 0 else 1 end,
        workflow.available_at asc,
        workflow.created_at asc
    for update skip locked
    limit 1;

    if candidate.id is null then
        return;
    end if;

    update public.collection_post_workflows
    set status = 'processing',
        attempt_count = attempt_count + 1,
        locked_at = now(),
        locked_by = p_agent_id,
        last_error = null,
        updated_at = now()
    where id = candidate.id
    returning * into claimed;

    update public.collection_hermes_cron_leases
    set workflow_id = claimed.id,
        locked_by = p_agent_id,
        locked_at = now(),
        lease_expires_at = now() + make_interval(secs => lease_seconds),
        updated_at = now()
    where lease_id = 1;

    return next claimed;
    return;
end;
$$;

revoke all on function public.claim_collection_hermes_cron_workflow(text, integer, text)
    from public, anon, authenticated;
grant execute on function public.claim_collection_hermes_cron_workflow(text, integer, text)
    to service_role;

commit;
