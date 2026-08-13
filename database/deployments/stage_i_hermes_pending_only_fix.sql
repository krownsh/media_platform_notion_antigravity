-- Stage I follow-up: never replay a transport-delivered historical row from a
-- normal one-shot wake. Existing delivered rows require an explicit reviewed
-- reconciliation; new capture completions remain status=pending.

begin;

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
    set dispatch_id = null, locked_by = null, locked_at = null,
        lease_expires_at = null, updated_at = now()
    where slot_id = 1;

    select dispatch.* into claimed
    from public.collection_hermes_dispatches dispatch
    where dispatch.attempt_count < dispatch.max_attempts
      and dispatch.available_at <= now()
      and dispatch.agent_status in ('pending', 'failed')
      and (
          dispatch.status in ('pending', 'failed')
          or (dispatch.status = 'processing'
              and dispatch.locked_at <= now() - make_interval(secs => lease_seconds))
      )
    order by dispatch.available_at asc, dispatch.created_at asc
    for update skip locked
    limit 1;

    if claimed.id is null then
        return null;
    end if;

    update public.collection_hermes_dispatches
    set status = 'processing', attempt_count = attempt_count + 1,
        locked_at = now(), locked_by = p_worker_id, last_error = null,
        agent_status = 'processing', agent_started_at = coalesce(agent_started_at, now()),
        agent_last_heartbeat_at = now(),
        agent_lease_expires_at = now() + make_interval(secs => lease_seconds),
        agent_locked_by = p_worker_id, agent_error = null, updated_at = now()
    where id = claimed.id
    returning * into claimed;

    update public.collection_hermes_agent_slots
    set dispatch_id = claimed.id, locked_by = p_worker_id, locked_at = now(),
        lease_expires_at = now() + make_interval(secs => lease_seconds), updated_at = now()
    where slot_id = 1;

    return claimed;
end;
$$;

commit;
