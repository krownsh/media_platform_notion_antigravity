-- Stage E: non-blocking capture intake and worker lease queue.
--
-- Deployment source, NOT a Supabase migration-history entry. Review against
-- the remote schema, apply to staging first, run advisors, then generate the
-- formal migration with the team's Supabase CLI workflow.
--
-- This deployment depends on Stage B's collection_posts,
-- collection_capture_outbox, and collection_update_updated_at_column().

begin;

create table if not exists public.collection_capture_requests (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    url text not null check (char_length(url) between 1 and 4096),
    status text not null default 'accepted'
        check (status in ('accepted', 'extracting', 'finalized', 'degraded', 'failed')),
    priority integer not null default 50 check (priority between 0 and 100),
    correlation_id text not null check (char_length(correlation_id) between 1 and 128),
    idempotency_key text not null check (char_length(idempotency_key) between 1 and 128),
    request_meta jsonb not null default '{}'::jsonb,
    attempt_count integer not null default 0 check (attempt_count >= 0),
    max_attempts integer not null default 3 check (max_attempts between 1 and 10),
    available_at timestamptz not null default now(),
    lease_owner text,
    lease_expires_at timestamptz,
    capture_quality text check (capture_quality in ('complete', 'degraded')),
    post_id uuid references public.collection_posts(id) on delete set null,
    outbox_event_id uuid references public.collection_capture_outbox(id) on delete set null,
    error_code text,
    error_message text,
    started_at timestamptz,
    finalized_at timestamptz,
    failed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint collection_capture_requests_user_idempotency_key
        unique (user_id, idempotency_key)
);

comment on table public.collection_capture_requests is
    'Durable non-blocking intake queue. Capture extraction finishes before Hermes AI jobs begin.';
comment on column public.collection_capture_requests.request_meta is
    'Transport metadata only. Expected keys: auth_type and client. Never store credentials or scraped source content here.';

create index if not exists collection_capture_requests_claim_idx
    on public.collection_capture_requests (priority desc, available_at, created_at)
    where status in ('accepted', 'extracting');
create index if not exists collection_capture_requests_user_created_idx
    on public.collection_capture_requests (user_id, created_at desc);
create index if not exists collection_capture_requests_post_id_idx
    on public.collection_capture_requests (post_id)
    where post_id is not null;
create index if not exists collection_capture_requests_outbox_event_id_idx
    on public.collection_capture_requests (outbox_event_id)
    where outbox_event_id is not null;

alter table public.collection_capture_requests enable row level security;

drop trigger if exists update_collection_capture_requests_updated_at
    on public.collection_capture_requests;
create trigger update_collection_capture_requests_updated_at
    before update on public.collection_capture_requests
    for each row execute procedure public.collection_update_updated_at_column();

create or replace function public.enqueue_collection_capture_request(
    p_user_id uuid,
    p_url text,
    p_idempotency_key text,
    p_correlation_id text,
    p_priority integer default 50,
    p_request_meta jsonb default '{}'::jsonb
)
returns public.collection_capture_requests
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_request public.collection_capture_requests;
begin
    if p_user_id is null then
        raise exception 'p_user_id is required' using errcode = '22023';
    end if;
    if nullif(btrim(p_url), '') is null or char_length(p_url) > 4096 then
        raise exception 'p_url must be 1-4096 characters' using errcode = '22023';
    end if;
    if nullif(btrim(p_idempotency_key), '') is null or char_length(p_idempotency_key) > 128 then
        raise exception 'p_idempotency_key must be 1-128 characters' using errcode = '22023';
    end if;
    if nullif(btrim(p_correlation_id), '') is null or char_length(p_correlation_id) > 128 then
        raise exception 'p_correlation_id must be 1-128 characters' using errcode = '22023';
    end if;

    insert into public.collection_capture_requests (
        user_id, url, idempotency_key, correlation_id, priority, request_meta
    ) values (
        p_user_id,
        btrim(p_url),
        p_idempotency_key,
        p_correlation_id,
        least(greatest(coalesce(p_priority, 50), 0), 100),
        coalesce(p_request_meta, '{}'::jsonb)
    )
    on conflict (user_id, idempotency_key) do nothing
    returning * into v_request;

    if v_request.id is null then
        select * into v_request
        from public.collection_capture_requests
        where user_id = p_user_id and idempotency_key = p_idempotency_key;
    end if;

    return v_request;
end;
$$;

create or replace function public.claim_collection_capture_request(
    p_worker_id text,
    p_lease_seconds integer default 900
)
returns setof public.collection_capture_requests
language sql
security invoker
set search_path = public, pg_temp
as $$
    with candidate as (
        select request.id
        from public.collection_capture_requests request
        where request.attempt_count < request.max_attempts
          and request.available_at <= now()
          and (
              request.status = 'accepted'
              or (
                  request.status = 'extracting'
                  and request.lease_expires_at is not null
                  and request.lease_expires_at <= now()
              )
          )
        order by request.priority desc, request.available_at, request.created_at
        for update skip locked
        limit 1
    )
    update public.collection_capture_requests request
    set status = 'extracting',
        lease_owner = p_worker_id,
        lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 30), 3600)),
        attempt_count = request.attempt_count + 1,
        started_at = coalesce(request.started_at, now()),
        error_code = null,
        error_message = null,
        updated_at = now()
    from candidate
    where request.id = candidate.id
      and nullif(btrim(p_worker_id), '') is not null
    returning request.*;
$$;

create or replace function public.complete_collection_capture_request(
    p_request_id uuid,
    p_worker_id text,
    p_status text,
    p_capture_quality text,
    p_post_id uuid,
    p_outbox_event_id uuid
)
returns public.collection_capture_requests
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_request public.collection_capture_requests;
begin
    if p_status not in ('finalized', 'degraded') then
        raise exception 'p_status must be finalized or degraded' using errcode = '22023';
    end if;

    update public.collection_capture_requests request
    set status = p_status,
        capture_quality = p_capture_quality,
        post_id = p_post_id,
        outbox_event_id = p_outbox_event_id,
        lease_owner = null,
        lease_expires_at = null,
        finalized_at = now(),
        failed_at = null,
        error_code = null,
        error_message = null,
        updated_at = now()
    where request.id = p_request_id
      and request.status = 'extracting'
      and request.lease_owner = p_worker_id
    returning * into v_request;

    if v_request.id is null then
        raise exception 'capture request is not leased by this worker' using errcode = 'P0001';
    end if;
    return v_request;
end;
$$;

create or replace function public.fail_collection_capture_request(
    p_request_id uuid,
    p_worker_id text,
    p_retryable boolean,
    p_error_code text,
    p_error_message text
)
returns public.collection_capture_requests
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_request public.collection_capture_requests;
begin
    update public.collection_capture_requests request
    set status = case
            when p_retryable and request.attempt_count < request.max_attempts then 'accepted'
            else 'failed'
        end,
        available_at = case
            when p_retryable and request.attempt_count < request.max_attempts
                then now() + make_interval(secs => least(request.attempt_count * 30, 900))
            else request.available_at
        end,
        lease_owner = null,
        lease_expires_at = null,
        error_code = left(coalesce(p_error_code, 'CAPTURE_FAILED'), 160),
        error_message = left(coalesce(p_error_message, 'Unknown capture failure'), 4000),
        failed_at = case
            when not p_retryable or request.attempt_count >= request.max_attempts then now()
            else null
        end,
        updated_at = now()
    where request.id = p_request_id
      and request.status = 'extracting'
      and request.lease_owner = p_worker_id
    returning * into v_request;

    if v_request.id is null then
        raise exception 'capture request is not leased by this worker' using errcode = 'P0001';
    end if;
    return v_request;
end;
$$;

revoke all on table public.collection_capture_requests from public, anon, authenticated;
grant select, insert, update on table public.collection_capture_requests to service_role;

revoke all on function public.enqueue_collection_capture_request(uuid, text, text, text, integer, jsonb)
    from public, anon, authenticated;
revoke all on function public.claim_collection_capture_request(text, integer)
    from public, anon, authenticated;
revoke all on function public.complete_collection_capture_request(uuid, text, text, text, uuid, uuid)
    from public, anon, authenticated;
revoke all on function public.fail_collection_capture_request(uuid, text, boolean, text, text)
    from public, anon, authenticated;

grant execute on function public.enqueue_collection_capture_request(uuid, text, text, text, integer, jsonb)
    to service_role;
grant execute on function public.claim_collection_capture_request(text, integer)
    to service_role;
grant execute on function public.complete_collection_capture_request(uuid, text, text, text, uuid, uuid)
    to service_role;
grant execute on function public.fail_collection_capture_request(uuid, text, boolean, text, text)
    to service_role;

commit;
