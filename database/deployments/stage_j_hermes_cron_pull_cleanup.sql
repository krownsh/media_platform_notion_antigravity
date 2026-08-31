-- Stage J: remove the legacy Hermes webhook dispatcher and add the Cron Pull lease.
--
-- This deployment is intentionally scoped to the Hermes Webhook/Dispatcher
-- objects created by Stages H/I. The shared Collection capture and workflow
-- tables remain untouched. The existing Hermes Gateway configuration is also
-- intentionally outside this migration and may remain dormant for future use.

begin;

-- Stop creating new transport-dispatch rows before removing the dispatcher.
drop trigger if exists enqueue_collection_hermes_dispatch
    on public.collection_post_workflows;
drop function if exists public.enqueue_collection_hermes_dispatch();

-- Hermes Cron needs one durable lease, but it does not need a second dispatch
-- outbox. The workflow table remains the only work source of truth.
create table if not exists public.collection_hermes_cron_leases (
    lease_id smallint primary key check (lease_id = 1),
    workflow_id uuid references public.collection_post_workflows(id) on delete set null,
    locked_by text,
    locked_at timestamptz,
    lease_expires_at timestamptz,
    updated_at timestamptz not null default now()
);

insert into public.collection_hermes_cron_leases (lease_id)
values (1)
on conflict (lease_id) do nothing;

comment on table public.collection_hermes_cron_leases is
    'Singleton durable lease for the Hermes Cron Pull. At most one workflow may be processed at a time.';

alter table public.collection_hermes_cron_leases enable row level security;

drop trigger if exists update_collection_hermes_cron_leases_updated_at
    on public.collection_hermes_cron_leases;
create trigger update_collection_hermes_cron_leases_updated_at
    before update on public.collection_hermes_cron_leases
    for each row execute procedure public.collection_update_updated_at_column();

-- Cron is FIFO for pending work. Failed retries retain priority, but an item
-- must still be available and below its retry limit.
drop index if exists public.collection_post_workflows_next_idx;
create index if not exists collection_post_workflows_next_idx
    on public.collection_post_workflows (status, available_at, created_at asc)
    where status in ('pending', 'failed');

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

create or replace function public.heartbeat_collection_hermes_cron_workflow(
    p_workflow_id uuid,
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
    refreshed public.collection_post_workflows;
    lease_seconds integer := greatest(60, least(coalesce(p_lease_seconds, 1800), 7200));
begin
    if p_agent_id is null or p_agent_id !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'Invalid Hermes Cron agent identity';
    end if;

    select * into lease
    from public.collection_hermes_cron_leases
    where lease_id = 1
    for update;

    if lease.workflow_id <> p_workflow_id
       or lease.locked_by <> p_agent_id
       or lease.lease_expires_at is null
       or lease.lease_expires_at <= now() then
        raise exception 'Hermes Cron lease is invalid or expired';
    end if;

    update public.collection_post_workflows
    set locked_at = now(),
        updated_at = now()
    where id = p_workflow_id
      and status = 'processing'
      and locked_by = p_agent_id
    returning * into refreshed;

    if refreshed.id is null then
        raise exception 'Hermes Cron workflow is no longer processing under this identity';
    end if;

    update public.collection_hermes_cron_leases
    set locked_at = now(),
        lease_expires_at = now() + make_interval(secs => lease_seconds),
        updated_at = now()
    where lease_id = 1;

    return next refreshed;
    return;
end;
$$;

create or replace function public.release_collection_hermes_cron_workflow(
    p_workflow_id uuid,
    p_agent_id text
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    released boolean := false;
begin
    if p_agent_id is null or p_agent_id !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'Invalid Hermes Cron agent identity';
    end if;

    update public.collection_hermes_cron_leases
    set workflow_id = null,
        locked_by = null,
        locked_at = null,
        lease_expires_at = null,
        updated_at = now()
    where lease_id = 1
      and workflow_id = p_workflow_id
      and locked_by = p_agent_id
    returning true into released;

    return coalesce(released, false);
end;
$$;

-- Remove every Stage H/I transport object. Do this explicitly, without CASCADE,
-- so an unexpected shared-database dependency aborts the migration safely.
drop function if exists public.claim_collection_hermes_dispatch(text, integer);
drop function if exists public.complete_collection_hermes_dispatch(uuid, text, integer);
drop function if exists public.fail_collection_hermes_dispatch(uuid, text, boolean, integer, text);
drop function if exists public.start_collection_hermes_agent(uuid, text, integer);
drop function if exists public.heartbeat_collection_hermes_agent(uuid, text, integer);
drop function if exists public.finish_collection_hermes_agent(uuid, text, text, text);

drop table if exists public.collection_hermes_agent_slots;
drop table if exists public.collection_hermes_dispatches;

revoke all on table public.collection_hermes_cron_leases from public, anon, authenticated;
grant select, insert, update on table public.collection_hermes_cron_leases to service_role;

revoke all on function public.claim_collection_hermes_cron_workflow(text, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_collection_hermes_cron_workflow(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.release_collection_hermes_cron_workflow(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_collection_hermes_cron_workflow(text, integer) to service_role;
grant execute on function public.heartbeat_collection_hermes_cron_workflow(uuid, text, integer) to service_role;
grant execute on function public.release_collection_hermes_cron_workflow(uuid, text) to service_role;

commit;
