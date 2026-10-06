-- Owner-guided capture cutover (M1).
-- Apply after Stage F, first in staging. This deployment preserves historical
-- legacy rows but prevents new capture from starting the old semantic chain.

begin;

create table if not exists public.collection_source_revisions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    post_id uuid not null references public.collection_posts(id) on delete cascade,
    correlation_id text not null check (char_length(correlation_id) between 1 and 128),
    pipeline_version text not null check (char_length(pipeline_version) between 1 and 128),
    capture_quality text not null check (capture_quality in ('complete', 'partial')),
    source_payload jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, correlation_id)
);

comment on table public.collection_source_revisions is
    'Immutable raw-source revision. Repeated correlation IDs return the first captured revision; a new correlation ID creates a new revision.';
comment on column public.collection_source_revisions.source_payload is
    'JSONB schema v1: {schema_version: 1, source: string, post: object, media: array, comments: array}. Contains source facts only; never AI analysis, folder, Topic, note, project, approval, or POC fields.';

create index if not exists collection_source_revisions_post_created_idx
    on public.collection_source_revisions (post_id, created_at desc);

alter table public.collection_source_revisions enable row level security;
drop policy if exists "Users can view their own source revisions" on public.collection_source_revisions;
create policy "Users can view their own source revisions"
    on public.collection_source_revisions for select to authenticated
    using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- Supabase's Data API no longer grants new public tables automatically.
-- Browser clients can read only their own source evidence; all mutation is
-- confined to server-side service-role RPCs.
revoke all on table public.collection_source_revisions from anon, authenticated;
grant select on table public.collection_source_revisions to authenticated;
grant select, insert, update, delete on table public.collection_source_revisions to service_role;

drop trigger if exists update_collection_source_revisions_updated_at on public.collection_source_revisions;
create trigger update_collection_source_revisions_updated_at
    before update on public.collection_source_revisions
    for each row execute procedure public.collection_update_updated_at_column();

alter table public.collection_capture_requests
    add column if not exists source_revision_id uuid
        references public.collection_source_revisions(id) on delete set null;
alter table public.collection_capture_requests
    drop constraint if exists collection_capture_requests_capture_quality_check;
alter table public.collection_capture_requests
    add constraint collection_capture_requests_capture_quality_check
        check (capture_quality is null or capture_quality in ('complete', 'partial'));

create index if not exists collection_capture_requests_source_revision_id_idx
    on public.collection_capture_requests (source_revision_id)
    where source_revision_id is not null;

-- Output shape gains source_revision_id. This exact function signature is
-- owned by the service role, so replacing it is an intentional cutover.
drop function if exists public.finalize_collection_capture(
    uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
);

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
    source_revision_id uuid,
    outbox_event_id uuid,
    outbox_event_created boolean
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_post_id uuid;
    v_source_revision_id uuid;
begin
    if p_user_id is null then
        raise exception 'p_user_id is required' using errcode = '22023';
    end if;
    if nullif(btrim(p_correlation_id), '') is null or char_length(p_correlation_id) > 128 then
        raise exception 'p_correlation_id must be 1-128 characters' using errcode = '22023';
    end if;
    if nullif(btrim(p_pipeline_version), '') is null or char_length(p_pipeline_version) > 128 then
        raise exception 'p_pipeline_version must be 1-128 characters' using errcode = '22023';
    end if;
    if p_capture_quality not in ('complete', 'partial') then
        raise exception 'p_capture_quality must be complete or partial' using errcode = '22023';
    end if;
    if nullif(btrim(p_post ->> 'original_url'), '') is null then
        raise exception 'p_post.original_url is required' using errcode = '22023';
    end if;
    if coalesce(p_post ->> 'platform', 'generic') not in
        ('instagram', 'facebook', 'twitter', 'threads', 'generic', 'notion', 'youtube', 'github', 'image') then
        raise exception 'Unsupported capture platform: %', p_post ->> 'platform' using errcode = '22023';
    end if;
    if coalesce(p_analysis, '{}'::jsonb) <> '{}'::jsonb then
        raise exception 'p_analysis must be an empty object for owner-guided capture' using errcode = '22023';
    end if;

    -- A retry has the same correlation ID and must preserve the first source
    -- snapshot rather than silently overwriting it.
    select revision.post_id, revision.id
    into v_post_id, v_source_revision_id
    from public.collection_source_revisions revision
    where revision.user_id = p_user_id
      and revision.correlation_id = p_correlation_id;
    if v_source_revision_id is not null then
        return query select v_post_id, v_source_revision_id, null::uuid, false;
        return;
    end if;

    insert into public.collection_posts (
        user_id, platform, original_url, title, author_name, author_id,
        author_avatar_url, content, posted_at, is_archived, full_json, source_domains
    ) values (
        p_user_id, coalesce(p_post ->> 'platform', 'generic'), p_post ->> 'original_url',
        nullif(p_post ->> 'title', ''), p_post ->> 'author_name', p_post ->> 'author_id', null,
        p_post ->> 'content', nullif(p_post ->> 'posted_at', '')::timestamptz,
        coalesce((p_post ->> 'is_archived')::boolean, false), p_post -> 'full_json',
        coalesce(array(select jsonb_array_elements_text(p_post -> 'source_domains')), '{}'::text[])
    )
    on conflict (user_id, original_url) do update
    set platform = excluded.platform,
        title = excluded.title,
        author_name = excluded.author_name,
        author_id = excluded.author_id,
        author_avatar_url = null,
        content = excluded.content,
        posted_at = excluded.posted_at,
        is_archived = excluded.is_archived,
        full_json = excluded.full_json,
        source_domains = excluded.source_domains,
        updated_at = now()
    returning id into v_post_id;

    delete from public.collection_post_media media_row where media_row.post_id = v_post_id;
    insert into public.collection_post_media (
        post_id, user_id, type, url, "order", storage_bucket, storage_path,
        content_type, byte_size, original_filename
    )
    select
        v_post_id, p_user_id, 'image', media.value ->> 'url',
        coalesce(nullif(media.value ->> 'order', '')::integer, media.ordinality - 1),
        nullif(media.value ->> 'storage_bucket', ''), nullif(media.value ->> 'storage_path', ''),
        nullif(media.value ->> 'content_type', ''), nullif(media.value ->> 'byte_size', '')::bigint,
        nullif(media.value ->> 'original_filename', '')
    from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) with ordinality as media(value, ordinality)
    where nullif(btrim(media.value ->> 'url'), '') is not null;

    delete from public.collection_post_comments comment_row where comment_row.post_id = v_post_id;
    insert into public.collection_post_comments (post_id, user_id, author_name, content, commented_at, raw_data)
    select
        v_post_id, p_user_id, comment.value ->> 'author_name', comment.value ->> 'content',
        nullif(comment.value ->> 'commented_at', '')::timestamptz,
        coalesce(comment.value -> 'raw_data', '{}'::jsonb)
    from jsonb_array_elements(coalesce(p_comments, '[]'::jsonb)) as comment(value);

    insert into public.collection_source_revisions (
        user_id, post_id, correlation_id, pipeline_version, capture_quality, source_payload
    ) values (
        p_user_id, v_post_id, p_correlation_id, p_pipeline_version, p_capture_quality,
        jsonb_build_object(
            'schema_version', 1,
            'source', coalesce(nullif(p_post ->> 'source_type', ''), 'url_capture'),
            'post', p_post,
            'media', coalesce(p_media, '[]'::jsonb),
            'comments', coalesce(p_comments, '[]'::jsonb)
        )
    ) returning id into v_source_revision_id;

    -- No collection_capture_outbox write: semantic work is proposal-first.
    return query select v_post_id, v_source_revision_id, null::uuid, false;
end;
$$;

create or replace function public.complete_collection_capture_request(
    p_request_id uuid,
    p_worker_id text,
    p_status text,
    p_capture_quality text,
    p_post_id uuid,
    p_source_revision_id uuid,
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
    if p_status <> 'finalized' then
        raise exception 'p_status must be finalized for owner-guided capture' using errcode = '22023';
    end if;
    if p_capture_quality not in ('complete', 'partial') then
        raise exception 'p_capture_quality must be complete or partial' using errcode = '22023';
    end if;
    if p_post_id is null or p_source_revision_id is null then
        raise exception 'p_post_id and p_source_revision_id are required' using errcode = '22023';
    end if;
    if p_outbox_event_id is not null then
        raise exception 'p_outbox_event_id must be null for owner-guided capture' using errcode = '22023';
    end if;

    update public.collection_capture_requests request
    set status = p_status,
        capture_quality = p_capture_quality,
        post_id = p_post_id,
        source_revision_id = p_source_revision_id,
        outbox_event_id = null,
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

revoke all on function public.finalize_collection_capture(
    uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.finalize_collection_capture(
    uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) to service_role;
revoke all on function public.complete_collection_capture_request(
    uuid, text, text, text, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.complete_collection_capture_request(
    uuid, text, text, text, uuid, uuid, uuid
) to service_role;

commit;
