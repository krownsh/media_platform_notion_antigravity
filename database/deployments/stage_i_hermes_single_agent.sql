-- Stage I: one-shot Hermes dispatch and a single durable Agent slot.
--
-- Capture completion creates a durable dispatch row. The Capture Worker (or a
-- Hermes cron/manual command) attempts one dispatch and then stops. This
-- migration deliberately adds no polling process and no timer-driven trigger.

begin;

alter table public.collection_hermes_dispatches
    add column if not exists agent_status text not null default 'pending'
        check (agent_status in ('pending', 'processing', 'awaiting_user', 'completed', 'failed')),
    add column if not exists agent_started_at timestamptz,
    add column if not exists agent_finished_at timestamptz,
    add column if not exists agent_last_heartbeat_at timestamptz,
    add column if not exists agent_lease_expires_at timestamptz,
    add column if not exists agent_locked_by text,
    add column if not exists agent_error text;

create table if not exists public.collection_hermes_agent_slots (
    slot_id smallint primary key check (slot_id = 1),
    dispatch_id uuid references public.collection_hermes_dispatches(id) on delete set null,
    locked_by text,
    locked_at timestamptz,
    lease_expires_at timestamptz,
    updated_at timestamptz not null default now()
);

insert into public.collection_hermes_agent_slots (slot_id)
values (1)
on conflict (slot_id) do nothing;

comment on table public.collection_hermes_agent_slots is
    'Singleton durable semaphore. At most one Hermes Agent workflow may run at a time.';

create index if not exists collection_hermes_dispatches_agent_claim_idx
    on public.collection_hermes_dispatches (agent_status, available_at, created_at)
    where status in ('pending', 'failed', 'processing');

alter table public.collection_hermes_agent_slots enable row level security;

drop trigger if exists update_collection_hermes_agent_slots_updated_at
    on public.collection_hermes_agent_slots;
create trigger update_collection_hermes_agent_slots_updated_at
    before update on public.collection_hermes_agent_slots
    for each row execute procedure public.collection_update_updated_at_column();

create or replace function public.claim_collection_hermes_dispatch(
    p_worker_id text,
    p_lease_seconds integer default 1800
)
returns public.collection_hermes_dispatches
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    claimed public.collection_hermes_dispatches;
    slot public.collection_hermes_agent_slots;
    stale_dispatch_id uuid;
    lease_seconds integer := greatest(60, least(coalesce(p_lease_seconds, 1800), 7200));
begin
    if p_worker_id is null or p_worker_id !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'Invalid Hermes dispatch worker identity';
    end if;

    select * into slot
    from public.collection_hermes_agent_slots
    where slot_id = 1
    for update;

    if slot.lease_expires_at is not null and slot.lease_expires_at > now() then
        return null;
    end if;

    stale_dispatch_id := slot.dispatch_id;
    if stale_dispatch_id is not null then
        update public.collection_hermes_dispatches
        set status = 'pending',
            agent_status = 'failed',
            agent_finished_at = now(),
            agent_error = left(coalesce(agent_error, 'Hermes Agent lease expired before completion'), 4000),
            agent_locked_by = null,
            agent_lease_expires_at = null,
            request_id = uuid_generate_v4(),
            available_at = now(),
            locked_at = null,
            locked_by = null,
            updated_at = now()
        where id = stale_dispatch_id
          and agent_status = 'processing';
    end if;

    update public.collection_hermes_agent_slots
    set dispatch_id = null,
        locked_by = null,
        locked_at = null,
        lease_expires_at = null,
        updated_at = now()
    where slot_id = 1;

    select dispatch.* into claimed
    from public.collection_hermes_dispatches dispatch
    where dispatch.attempt_count < dispatch.max_attempts
      and dispatch.available_at <= now()
      and dispatch.agent_status in ('pending', 'failed')
      and (
          dispatch.status in ('pending', 'failed')
          or (
              dispatch.status = 'processing'
              and dispatch.locked_at <= now() - make_interval(secs => lease_seconds)
          )
      )
    order by dispatch.available_at asc, dispatch.created_at asc
    for update skip locked
    limit 1;

    if claimed.id is null then
        return null;
    end if;

    update public.collection_hermes_dispatches
    set status = 'processing',
        attempt_count = attempt_count + 1,
        locked_at = now(),
        locked_by = p_worker_id,
        last_error = null,
        agent_status = 'processing',
        agent_started_at = coalesce(agent_started_at, now()),
        agent_last_heartbeat_at = now(),
        agent_lease_expires_at = now() + make_interval(secs => lease_seconds),
        agent_locked_by = p_worker_id,
        agent_error = null,
        updated_at = now()
    where id = claimed.id
    returning * into claimed;

    update public.collection_hermes_agent_slots
    set dispatch_id = claimed.id,
        locked_by = p_worker_id,
        locked_at = now(),
        lease_expires_at = now() + make_interval(secs => lease_seconds),
        updated_at = now()
    where slot_id = 1;

    return claimed;
end;
$$;

create or replace function public.start_collection_hermes_agent(
    p_dispatch_id uuid,
    p_agent_id text,
    p_lease_seconds integer default 1800
)
returns public.collection_hermes_dispatches
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    current_dispatch public.collection_hermes_dispatches;
    slot public.collection_hermes_agent_slots;
    lease_seconds integer := greatest(60, least(coalesce(p_lease_seconds, 1800), 7200));
begin
    if p_agent_id is null or p_agent_id !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'Invalid Hermes agent identity';
    end if;

    select * into slot from public.collection_hermes_agent_slots where slot_id = 1 for update;
    select * into current_dispatch from public.collection_hermes_dispatches where id = p_dispatch_id for update;

    if current_dispatch.id is null then
        raise exception 'Hermes dispatch was not found';
    end if;
    if coalesce(slot.dispatch_id <> p_dispatch_id, true)
       or current_dispatch.agent_status <> 'processing' then
        raise exception 'Hermes dispatch is not reserved for an Agent run';
    end if;
    if slot.lease_expires_at <= now() then
        raise exception 'Hermes Agent lease has expired';
    end if;

    update public.collection_hermes_dispatches
    set agent_locked_by = p_agent_id,
        agent_last_heartbeat_at = now(),
        agent_lease_expires_at = now() + make_interval(secs => lease_seconds),
        updated_at = now()
    where id = p_dispatch_id
    returning * into current_dispatch;

    update public.collection_hermes_agent_slots
    set locked_by = p_agent_id,
        locked_at = now(),
        lease_expires_at = now() + make_interval(secs => lease_seconds),
        updated_at = now()
    where slot_id = 1;

    return current_dispatch;
end;
$$;

create or replace function public.heartbeat_collection_hermes_agent(
    p_dispatch_id uuid,
    p_agent_id text,
    p_lease_seconds integer default 1800
)
returns public.collection_hermes_dispatches
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    refreshed public.collection_hermes_dispatches;
    lease_seconds integer := greatest(60, least(coalesce(p_lease_seconds, 1800), 7200));
begin
    update public.collection_hermes_dispatches
    set agent_last_heartbeat_at = now(),
        agent_lease_expires_at = now() + make_interval(secs => lease_seconds),
        updated_at = now()
    where id = p_dispatch_id
      and agent_status = 'processing'
      and agent_locked_by = p_agent_id
      and agent_lease_expires_at > now()
    returning * into refreshed;

    if refreshed.id is null then
        raise exception 'Hermes Agent heartbeat lease is invalid or expired';
    end if;
    update public.collection_hermes_agent_slots
    set lease_expires_at = now() + make_interval(secs => lease_seconds), updated_at = now()
    where slot_id = 1 and dispatch_id = p_dispatch_id and locked_by = p_agent_id;
    return refreshed;
end;
$$;

create or replace function public.finish_collection_hermes_agent(
    p_dispatch_id uuid,
    p_agent_id text,
    p_result_status text,
    p_error_message text default null
)
returns public.collection_hermes_dispatches
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    finished public.collection_hermes_dispatches;
begin
    if p_result_status not in ('awaiting_user', 'completed', 'failed') then
        raise exception 'Invalid Hermes Agent result status';
    end if;

    update public.collection_hermes_dispatches
    set agent_status = p_result_status,
        agent_finished_at = now(),
        agent_last_heartbeat_at = now(),
        agent_lease_expires_at = null,
        agent_locked_by = null,
        agent_error = case when p_result_status = 'failed' then left(nullif(p_error_message, ''), 4000) else null end,
        status = case when p_result_status = 'failed' then 'pending' else 'delivered' end,
        request_id = case when p_result_status = 'failed' then uuid_generate_v4() else request_id end,
        available_at = case when p_result_status = 'failed' then now() else available_at end,
        locked_at = null,
        locked_by = null,
        last_error = case when p_result_status = 'failed' then left(nullif(p_error_message, ''), 4000) else last_error end,
        updated_at = now()
    where id = p_dispatch_id
      and agent_status = 'processing'
      and agent_locked_by = p_agent_id
    returning * into finished;

    if finished.id is null then
        raise exception 'Hermes Agent run is not leased by this identity';
    end if;

    update public.collection_hermes_agent_slots
    set dispatch_id = null,
        locked_by = null,
        locked_at = null,
        lease_expires_at = null,
        updated_at = now()
    where slot_id = 1 and dispatch_id = p_dispatch_id and locked_by = p_agent_id;

    return finished;
end;
$$;

-- Replace the transport failure function so a failed HTTP delivery also
-- releases the singleton Agent slot.
create or replace function public.fail_collection_hermes_dispatch(
    p_dispatch_id uuid,
    p_worker_id text,
    p_retryable boolean,
    p_http_status integer,
    p_error_message text
)
returns public.collection_hermes_dispatches
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    current_dispatch public.collection_hermes_dispatches;
    failed public.collection_hermes_dispatches;
    next_status text;
    retry_delay_seconds integer;
begin
    select * into current_dispatch
    from public.collection_hermes_dispatches
    where id = p_dispatch_id and status = 'processing' and locked_by = p_worker_id
    for update;
    if current_dispatch.id is null then
        raise exception 'Hermes dispatch is not leased by this worker';
    end if;

    next_status := case
        when coalesce(p_retryable, true) = false then 'dead_letter'
        when current_dispatch.attempt_count >= current_dispatch.max_attempts then 'dead_letter'
        else 'failed'
    end;
    retry_delay_seconds := least(900, 5 * power(2, greatest(current_dispatch.attempt_count - 1, 0))::integer);

    update public.collection_hermes_dispatches
    set status = next_status,
        agent_status = 'failed',
        agent_finished_at = now(),
        agent_lease_expires_at = null,
        agent_locked_by = null,
        available_at = case when next_status = 'failed' then now() + make_interval(secs => retry_delay_seconds) else available_at end,
        last_http_status = p_http_status,
        last_error = left(coalesce(nullif(p_error_message, ''), 'Hermes webhook dispatch failed'), 4000),
        agent_error = left(coalesce(nullif(p_error_message, ''), 'Hermes webhook dispatch failed'), 4000),
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = current_dispatch.id
    returning * into failed;

    update public.collection_hermes_agent_slots
    set dispatch_id = null, locked_by = null, locked_at = null, lease_expires_at = null, updated_at = now()
    where slot_id = 1 and dispatch_id = current_dispatch.id;
    return failed;
end;
$$;

revoke all on table public.collection_hermes_agent_slots from public, anon, authenticated;
grant select, insert, update on table public.collection_hermes_agent_slots to service_role;

revoke all on function public.start_collection_hermes_agent(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_collection_hermes_agent(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.finish_collection_hermes_agent(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.start_collection_hermes_agent(uuid, text, integer) to service_role;
grant execute on function public.heartbeat_collection_hermes_agent(uuid, text, integer) to service_role;
grant execute on function public.finish_collection_hermes_agent(uuid, text, text, text) to service_role;

commit;
