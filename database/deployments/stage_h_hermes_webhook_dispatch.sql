-- Stage H: durable Hermes webhook dispatch.
--
-- This deployment adds a transport outbox between the durable post workflow
-- and Hermes Agent's webhook gateway. It deliberately does not reuse
-- collection_capture_outbox: that outbox is leased by Hermes while processing
-- the source, whereas this table only records whether a wake-up was accepted.
--
-- Deployment source only. Generate and review a formal migration before
-- applying it to the shared Supabase project.

begin;

create table if not exists public.collection_hermes_dispatches (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    workflow_id uuid not null references public.collection_post_workflows(id) on delete cascade,
    post_id uuid not null references public.collection_posts(id) on delete cascade,
    dispatch_version integer not null default 1 check (dispatch_version > 0),
    event_type text not null default 'collection.workflow.ready.v1'
        check (event_type = 'collection.workflow.ready.v1'),
    status text not null default 'pending'
        check (status in ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
    request_id uuid not null default uuid_generate_v4(),
    attempt_count integer not null default 0 check (attempt_count >= 0),
    max_attempts integer not null default 5 check (max_attempts between 1 and 10),
    available_at timestamptz not null default now(),
    locked_at timestamptz,
    locked_by text,
    last_http_status integer,
    last_error text,
    delivered_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint collection_hermes_dispatches_workflow_version_unique
        unique (workflow_id, dispatch_version),
    constraint collection_hermes_dispatches_request_unique unique (request_id)
);

comment on table public.collection_hermes_dispatches is
    'Durable wake-up delivery from a post workflow to the Hermes webhook gateway. Delivered means Hermes accepted the event, not that the post workflow completed.';
comment on column public.collection_hermes_dispatches.request_id is
    'Stable X-Request-ID used for Hermes webhook idempotency across retries.';

create index if not exists collection_hermes_dispatches_claim_idx
    on public.collection_hermes_dispatches (available_at, created_at)
    where status in ('pending', 'failed', 'processing');
create index if not exists collection_hermes_dispatches_workflow_idx
    on public.collection_hermes_dispatches (workflow_id);

alter table public.collection_hermes_dispatches enable row level security;

drop trigger if exists update_collection_hermes_dispatches_updated_at
    on public.collection_hermes_dispatches;
create trigger update_collection_hermes_dispatches_updated_at
    before update on public.collection_hermes_dispatches
    for each row execute procedure public.collection_update_updated_at_column();

create or replace function public.enqueue_collection_hermes_dispatch()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
    insert into public.collection_hermes_dispatches (
        user_id,
        workflow_id,
        post_id,
        dispatch_version
    ) values (
        new.user_id,
        new.id,
        new.post_id,
        1
    )
    on conflict (workflow_id, dispatch_version) do nothing;
    return new;
end;
$$;

drop trigger if exists enqueue_collection_hermes_dispatch
    on public.collection_post_workflows;
create trigger enqueue_collection_hermes_dispatch
    after insert on public.collection_post_workflows
    for each row execute procedure public.enqueue_collection_hermes_dispatch();

create or replace function public.claim_collection_hermes_dispatch(
    p_worker_id text,
    p_lease_seconds integer default 60
)
returns public.collection_hermes_dispatches
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    claimed public.collection_hermes_dispatches;
    lease_seconds integer := greatest(15, least(coalesce(p_lease_seconds, 60), 900));
begin
    if p_worker_id is null or p_worker_id !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'Invalid Hermes dispatch worker identity';
    end if;

    select dispatch.*
    into claimed
    from public.collection_hermes_dispatches dispatch
    where dispatch.attempt_count < dispatch.max_attempts
      and dispatch.available_at <= now()
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
        last_error = null
    where id = claimed.id
    returning * into claimed;

    return claimed;
end;
$$;

create or replace function public.complete_collection_hermes_dispatch(
    p_dispatch_id uuid,
    p_worker_id text,
    p_http_status integer
)
returns public.collection_hermes_dispatches
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    completed public.collection_hermes_dispatches;
begin
    update public.collection_hermes_dispatches
    set status = 'delivered',
        last_http_status = p_http_status,
        last_error = null,
        delivered_at = now(),
        locked_at = null,
        locked_by = null
    where id = p_dispatch_id
      and status = 'processing'
      and locked_by = p_worker_id
    returning * into completed;

    if completed.id is null then
        raise exception 'Hermes dispatch is not leased by this worker';
    end if;
    return completed;
end;
$$;

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
    where id = p_dispatch_id
      and status = 'processing'
      and locked_by = p_worker_id
    for update;

    if current_dispatch.id is null then
        raise exception 'Hermes dispatch is not leased by this worker';
    end if;

    next_status := case
        when coalesce(p_retryable, true) = false then 'dead_letter'
        when current_dispatch.attempt_count >= current_dispatch.max_attempts then 'dead_letter'
        else 'failed'
    end;
    retry_delay_seconds := least(
        900,
        5 * power(2, greatest(current_dispatch.attempt_count - 1, 0))::integer
    );

    update public.collection_hermes_dispatches
    set status = next_status,
        available_at = case
            when next_status = 'failed' then now() + make_interval(secs => retry_delay_seconds)
            else available_at
        end,
        last_http_status = p_http_status,
        last_error = left(coalesce(nullif(p_error_message, ''), 'Hermes webhook dispatch failed'), 4000),
        locked_at = null,
        locked_by = null
    where id = current_dispatch.id
    returning * into failed;

    return failed;
end;
$$;

-- Do not automatically backfill existing workflows here. The current shared
-- database has a large triage backlog; it must be enqueued separately in a
-- reviewed, rate-limited batch to avoid an unexpected burst of agent runs.

revoke all on table public.collection_hermes_dispatches from public, anon, authenticated;
grant select, insert, update on table public.collection_hermes_dispatches to service_role;

revoke all on function public.enqueue_collection_hermes_dispatch() from public, anon, authenticated;
revoke all on function public.claim_collection_hermes_dispatch(text, integer) from public, anon, authenticated;
revoke all on function public.complete_collection_hermes_dispatch(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.fail_collection_hermes_dispatch(uuid, text, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.enqueue_collection_hermes_dispatch() to service_role;
grant execute on function public.claim_collection_hermes_dispatch(text, integer) to service_role;
grant execute on function public.complete_collection_hermes_dispatch(uuid, text, integer) to service_role;
grant execute on function public.fail_collection_hermes_dispatch(uuid, text, boolean, integer, text) to service_role;

commit;
