-- Stage J follow-up: include the complete retryable workflow backlog.
--
-- The singleton lease previously carried a 24-hour cutover field. That was an
-- unsafe operational policy: it stranded historical pending rows outside the
-- normal Cron path. Cron is now FIFO over every available pending/failed row.

begin;

alter table public.collection_hermes_cron_leases
    drop column if exists cron_eligible_after;

create or replace function public.claim_collection_hermes_cron_workflow(
    p_agent_id text,
    p_lease_seconds integer default 1800
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

    -- Recover a workflow whose Cron process disappeared after claiming it.
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

    -- FIFO across the entire available retryable queue. There is deliberately
    -- no created_at cutoff: historical pending rows are first-class work.
    select workflow.* into candidate
    from public.collection_post_workflows workflow
    where workflow.status in ('pending', 'failed')
      and workflow.available_at <= now()
      and workflow.attempt_count < workflow.max_attempts
      and (workflow.locked_at is null
           or workflow.locked_at <= now() - make_interval(secs => lease_seconds))
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

commit;
