-- Stage B source finalization + transactional outbox
--
-- Deployment source, NOT a Supabase migration-history entry. The Supabase CLI
-- is unavailable in this workspace, so create a formal migration from this
-- file before applying it to any environment. Apply only after the tenant-aware
-- collection_posts(user_id, original_url) constraint has been verified.
--
-- The function is intentionally service-role only. It is SECURITY INVOKER and
-- has no grants to anon/authenticated/PUBLIC, so it cannot become a browser
-- callable RLS bypass.

begin;

alter table public.collection_posts
    add column if not exists source_domains text[] not null default '{}'::text[];

comment on column public.collection_posts.source_domains is
    'Normalized source hostnames discovered during capture; empty when no outbound domains are detected.';

create table if not exists public.collection_capture_outbox (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    aggregate_type text not null check (aggregate_type = 'collection_post'),
    aggregate_id uuid not null references public.collection_posts(id) on delete cascade,
    event_type text not null check (event_type = 'source.ingested.v1'),
    correlation_id text not null check (char_length(correlation_id) between 1 and 128),
    idempotency_key text not null,
    payload jsonb not null,
    status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
    attempt_count integer not null default 0 check (attempt_count >= 0),
    available_at timestamptz not null default now(),
    locked_at timestamptz,
    locked_by text,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint collection_capture_outbox_user_idempotency_key unique (user_id, idempotency_key)
);

comment on table public.collection_capture_outbox is
    'Transactional outbox for source.ingested.v1. A worker may claim pending rows and deliver downstream route jobs.';
comment on column public.collection_capture_outbox.payload is
    'Event envelope: event_type, source_id (collection_posts.id), source_version_id (null for legacy V1), user_id, correlation_id, capture_quality, and pipeline_version.';

create index if not exists collection_capture_outbox_pending_idx
    on public.collection_capture_outbox (available_at, created_at)
    where status = 'pending';

alter table public.collection_capture_outbox enable row level security;

drop trigger if exists update_collection_capture_outbox_updated_at on public.collection_capture_outbox;
create trigger update_collection_capture_outbox_updated_at
    before update on public.collection_capture_outbox
    for each row execute procedure public.collection_update_updated_at_column();

create or replace function public.finalize_collection_capture(
    p_user_id uuid,
    p_correlation_id text,
    p_pipeline_version text,
    p_capture_quality text,
    p_post jsonb,
    p_analysis jsonb default '{}'::jsonb,
    p_media jsonb default '[]'::jsonb,
    p_comments jsonb default '[]'::jsonb
)
returns table (
    post_id uuid,
    outbox_event_id uuid,
    outbox_event_created boolean
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_post_id uuid;
    v_outbox_event_id uuid;
    v_outbox_event_created boolean := false;
    v_idempotency_key text;
begin
    if p_user_id is null then
        raise exception 'p_user_id is required' using errcode = '22023';
    end if;

    if nullif(btrim(p_correlation_id), '') is null or char_length(p_correlation_id) > 128 then
        raise exception 'p_correlation_id must be 1-128 characters' using errcode = '22023';
    end if;

    if nullif(btrim(p_post ->> 'original_url'), '') is null then
        raise exception 'p_post.original_url is required' using errcode = '22023';
    end if;

    if coalesce(p_post ->> 'platform', 'generic') not in
        ('instagram', 'facebook', 'twitter', 'threads', 'generic', 'notion', 'youtube', 'github') then
        raise exception 'Unsupported capture platform: %', p_post ->> 'platform' using errcode = '22023';
    end if;

    insert into public.collection_posts (
        user_id,
        platform,
        original_url,
        author_name,
        author_id,
        author_avatar_url,
        content,
        posted_at,
        is_archived,
        full_json,
        source_domains
    )
    values (
        p_user_id,
        coalesce(p_post ->> 'platform', 'generic'),
        p_post ->> 'original_url',
        p_post ->> 'author_name',
        p_post ->> 'author_id',
        p_post ->> 'author_avatar_url',
        p_post ->> 'content',
        nullif(p_post ->> 'posted_at', '')::timestamptz,
        coalesce((p_post ->> 'is_archived')::boolean, false),
        p_post -> 'full_json',
        coalesce(
            array(select jsonb_array_elements_text(p_post -> 'source_domains')),
            '{}'::text[]
        )
    )
    on conflict (user_id, original_url) do update
    set platform = excluded.platform,
        author_name = excluded.author_name,
        author_id = excluded.author_id,
        author_avatar_url = excluded.author_avatar_url,
        content = excluded.content,
        posted_at = excluded.posted_at,
        is_archived = excluded.is_archived,
        full_json = excluded.full_json,
        source_domains = excluded.source_domains,
        updated_at = now()
    returning id into v_post_id;

    delete from public.collection_post_analysis cpa where cpa.post_id = v_post_id;
    insert into public.collection_post_analysis (
        post_id, user_id, primary_category, summary, tags, topics, sentiment
    )
    values (
        v_post_id,
        p_user_id,
        coalesce(nullif(p_analysis ->> 'primary_category', ''), 'other'),
        p_analysis ->> 'summary',
        coalesce(array(select jsonb_array_elements_text(p_analysis -> 'tags')), '{}'::text[]),
        coalesce(array(select jsonb_array_elements_text(p_analysis -> 'topics')), '{}'::text[]),
        nullif(p_analysis ->> 'sentiment', '')
    );

    delete from public.collection_post_media cpm where cpm.post_id = v_post_id;
    insert into public.collection_post_media (post_id, user_id, type, url, "order")
    select
        v_post_id,
        p_user_id,
        'image',
        media.value ->> 'url',
        coalesce(nullif(media.value ->> 'order', '')::integer, media.ordinality - 1)
    from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) with ordinality as media(value, ordinality)
    where nullif(btrim(media.value ->> 'url'), '') is not null;

    delete from public.collection_post_comments cpc where cpc.post_id = v_post_id;
    insert into public.collection_post_comments (
        post_id, user_id, author_name, content, commented_at, raw_data
    )
    select
        v_post_id,
        p_user_id,
        comment.value ->> 'author_name',
        comment.value ->> 'content',
        nullif(comment.value ->> 'commented_at', '')::timestamptz,
        coalesce(comment.value -> 'raw_data', '{}'::jsonb)
    from jsonb_array_elements(coalesce(p_comments, '[]'::jsonb)) as comment(value);

    v_idempotency_key := format('%s:%s:%s', p_user_id, p_correlation_id, 'source.ingested.v1');

    insert into public.collection_capture_outbox (
        user_id,
        aggregate_type,
        aggregate_id,
        event_type,
        correlation_id,
        idempotency_key,
        payload
    )
    values (
        p_user_id,
        'collection_post',
        v_post_id,
        'source.ingested.v1',
        p_correlation_id,
        v_idempotency_key,
        jsonb_build_object(
            'event_type', 'source.ingested.v1',
            'source_id', v_post_id,
            'source_version_id', null,
            'user_id', p_user_id,
            'correlation_id', p_correlation_id,
            'capture_quality', p_capture_quality,
            'pipeline_version', p_pipeline_version
        )
    )
    on conflict (user_id, idempotency_key) do nothing
    returning id into v_outbox_event_id;

    if v_outbox_event_id is not null then
        v_outbox_event_created := true;
    else
        select id into v_outbox_event_id
        from public.collection_capture_outbox
        where user_id = p_user_id
          and idempotency_key = v_idempotency_key;
    end if;

    return query select v_post_id, v_outbox_event_id, v_outbox_event_created;
end;
$$;

revoke all on table public.collection_capture_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.collection_capture_outbox to service_role;
revoke all on function public.finalize_collection_capture(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb)
    from public, anon, authenticated;
grant execute on function public.finalize_collection_capture(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb)
    to service_role;

commit;
