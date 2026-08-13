-- Stage I follow-up: make Agent reservation checks NULL-safe for an empty slot.
begin;

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

commit;
