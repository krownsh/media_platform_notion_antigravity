-- Stage F: private image uploads through the durable capture queue.
--
-- Deployment source, NOT a Supabase migration-history entry. Apply after
-- stage_e_async_capture_requests.sql. The API uploads with the server-only
-- service key; browsers receive time-limited signed read URLs.

begin;

-- The existing owner policies are only effective when RLS is enabled. This
-- also protects direct image posts from cross-tenant Data API access.
alter table public.collection_posts enable row level security;

alter table public.collection_posts
    drop constraint if exists collection_posts_platform_check;
alter table public.collection_posts
    add constraint collection_posts_platform_check
    check (platform in (
        'instagram', 'facebook', 'twitter', 'threads', 'generic',
        'notion', 'youtube', 'github', 'image'
    ));

alter table public.collection_post_media
    add column if not exists storage_bucket text,
    add column if not exists storage_path text,
    add column if not exists content_type text,
    add column if not exists byte_size bigint,
    add column if not exists original_filename text;

alter table public.collection_post_media
    drop constraint if exists collection_post_media_storage_pair_check;
alter table public.collection_post_media
    add constraint collection_post_media_storage_pair_check check (
        (storage_bucket is null and storage_path is null)
        or (nullif(btrim(storage_bucket), '') is not null and nullif(btrim(storage_path), '') is not null)
    );
alter table public.collection_post_media
    drop constraint if exists collection_post_media_byte_size_check;
alter table public.collection_post_media
    add constraint collection_post_media_byte_size_check
    check (byte_size is null or byte_size > 0);

comment on column public.collection_post_media.storage_bucket is
    'Private Supabase Storage bucket for user-uploaded media; null for externally captured public media.';
comment on column public.collection_post_media.storage_path is
    'Object path inside storage_bucket. Hermes uses this stable reference instead of a temporary signed URL.';
comment on column public.collection_post_media.content_type is
    'Validated MIME type of the stored object.';
comment on column public.collection_post_media.byte_size is
    'Validated upload size in bytes.';
comment on column public.collection_post_media.original_filename is
    'Display-only client filename after normalization; never used as the Storage object key.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'collection_capture_uploads',
    'collection_capture_uploads',
    false,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.collection_capture_requests
    add column if not exists input_type text not null default 'url',
    add column if not exists storage_bucket text,
    add column if not exists storage_path text,
    add column if not exists media_content_type text,
    add column if not exists media_size_bytes bigint,
    add column if not exists original_filename text;

alter table public.collection_capture_requests
    alter column url drop not null;
alter table public.collection_capture_requests
    drop constraint if exists collection_capture_requests_input_type_check;
alter table public.collection_capture_requests
    add constraint collection_capture_requests_input_type_check
    check (input_type in ('url', 'image'));
alter table public.collection_capture_requests
    drop constraint if exists collection_capture_requests_input_payload_check;
alter table public.collection_capture_requests
    add constraint collection_capture_requests_input_payload_check check (
        (
            input_type = 'url'
            and nullif(btrim(url), '') is not null
            and storage_bucket is null
            and storage_path is null
            and media_content_type is null
            and media_size_bytes is null
        )
        or
        (
            input_type = 'image'
            and url is null
            and nullif(btrim(storage_bucket), '') is not null
            and nullif(btrim(storage_path), '') is not null
            and media_content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
            and media_size_bytes between 1 and 15728640
        )
    );

comment on column public.collection_capture_requests.input_type is
    'Capture source discriminator: url or image.';
comment on column public.collection_capture_requests.storage_bucket is
    'For image captures, the private Supabase Storage bucket. Null for URL captures.';
comment on column public.collection_capture_requests.storage_path is
    'For image captures, the immutable object path. Null for URL captures.';
comment on column public.collection_capture_requests.media_content_type is
    'Server-validated image MIME type.';
comment on column public.collection_capture_requests.media_size_bytes is
    'Server-validated image size in bytes, limited to 15 MB.';
comment on column public.collection_capture_requests.original_filename is
    'Normalized original client filename for display only.';

create index if not exists collection_capture_requests_input_type_idx
    on public.collection_capture_requests (input_type, created_at desc);

-- Stage E creates the URL enqueue function before input_type exists. Replace
-- it after adding image captures so one idempotency key cannot cross types.
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
        user_id, input_type, url, idempotency_key, correlation_id, priority, request_meta
    ) values (
        p_user_id,
        'url',
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

    if v_request.input_type <> 'url' then
        raise exception 'Idempotency key is already associated with an image capture' using errcode = '23505';
    end if;
    if v_request.url is distinct from btrim(p_url) then
        raise exception 'Idempotency key is already associated with a different URL capture' using errcode = '23505';
    end if;

    return v_request;
end;
$$;

create or replace function public.enqueue_collection_image_capture_request(
    p_user_id uuid,
    p_storage_bucket text,
    p_storage_path text,
    p_content_type text,
    p_size_bytes bigint,
    p_original_filename text,
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
    if nullif(btrim(p_storage_bucket), '') is null or nullif(btrim(p_storage_path), '') is null then
        raise exception 'Storage bucket and path are required' using errcode = '22023';
    end if;
    if btrim(p_storage_bucket) <> 'collection_capture_uploads' then
        raise exception 'Image capture storage bucket is not allowed' using errcode = '22023';
    end if;
    if p_content_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif') then
        raise exception 'Unsupported image content type' using errcode = '22023';
    end if;
    if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 15728640 then
        raise exception 'Image size must be between 1 byte and 15 MB' using errcode = '22023';
    end if;
    if nullif(btrim(p_idempotency_key), '') is null or char_length(p_idempotency_key) > 128 then
        raise exception 'p_idempotency_key must be 1-128 characters' using errcode = '22023';
    end if;
    if nullif(btrim(p_correlation_id), '') is null or char_length(p_correlation_id) > 128 then
        raise exception 'p_correlation_id must be 1-128 characters' using errcode = '22023';
    end if;

    insert into public.collection_capture_requests (
        user_id,
        input_type,
        url,
        storage_bucket,
        storage_path,
        media_content_type,
        media_size_bytes,
        original_filename,
        idempotency_key,
        correlation_id,
        priority,
        request_meta
    ) values (
        p_user_id,
        'image',
        null,
        btrim(p_storage_bucket),
        btrim(p_storage_path),
        p_content_type,
        p_size_bytes,
        nullif(left(btrim(coalesce(p_original_filename, '')), 180), ''),
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

    if v_request.input_type <> 'image' then
        raise exception 'Idempotency key is already associated with a URL capture' using errcode = '23505';
    end if;
    if v_request.storage_bucket is distinct from btrim(p_storage_bucket)
       or v_request.storage_path is distinct from btrim(p_storage_path)
       or v_request.media_content_type is distinct from p_content_type
       or v_request.media_size_bytes is distinct from p_size_bytes then
        raise exception 'Idempotency key is already associated with a different image capture' using errcode = '23505';
    end if;

    return v_request;
end;
$$;

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
        ('instagram', 'facebook', 'twitter', 'threads', 'generic', 'notion', 'youtube', 'github', 'image') then
        raise exception 'Unsupported capture platform: %', p_post ->> 'platform' using errcode = '22023';
    end if;

    insert into public.collection_posts (
        user_id,
        platform,
        original_url,
        title,
        author_name,
        author_id,
        author_avatar_url,
        content,
        posted_at,
        is_archived,
        full_json,
        source_domains
    ) values (
        p_user_id,
        coalesce(p_post ->> 'platform', 'generic'),
        p_post ->> 'original_url',
        nullif(p_post ->> 'title', ''),
        p_post ->> 'author_name',
        p_post ->> 'author_id',
        null,
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

    delete from public.collection_post_analysis cpa where cpa.post_id = v_post_id;
    insert into public.collection_post_analysis (
        post_id, user_id, primary_category, summary, tags, topics, sentiment
    ) values (
        v_post_id,
        p_user_id,
        coalesce(nullif(p_analysis ->> 'primary_category', ''), 'other'),
        p_analysis ->> 'summary',
        coalesce(array(select jsonb_array_elements_text(p_analysis -> 'tags')), '{}'::text[]),
        coalesce(array(select jsonb_array_elements_text(p_analysis -> 'topics')), '{}'::text[]),
        nullif(p_analysis ->> 'sentiment', '')
    );

    delete from public.collection_post_media cpm where cpm.post_id = v_post_id;
    insert into public.collection_post_media (
        post_id,
        user_id,
        type,
        url,
        "order",
        storage_bucket,
        storage_path,
        content_type,
        byte_size,
        original_filename
    )
    select
        v_post_id,
        p_user_id,
        'image',
        media.value ->> 'url',
        coalesce(nullif(media.value ->> 'order', '')::integer, media.ordinality - 1),
        nullif(media.value ->> 'storage_bucket', ''),
        nullif(media.value ->> 'storage_path', ''),
        nullif(media.value ->> 'content_type', ''),
        nullif(media.value ->> 'byte_size', '')::bigint,
        nullif(media.value ->> 'original_filename', '')
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
    ) values (
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
            'source_type', coalesce(nullif(p_post ->> 'source_type', ''), 'url_capture'),
            'user_id', p_user_id,
            'correlation_id', p_correlation_id,
            'capture_quality', p_capture_quality,
            'pipeline_version', p_pipeline_version,
            'media', coalesce(p_media, '[]'::jsonb)
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

create or replace function public.record_collection_image_analysis(
    p_outbox_id uuid,
    p_agent_identity text,
    p_result jsonb
)
returns public.collection_post_analysis
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid;
    v_post_id uuid;
    v_platform text;
    v_analysis public.collection_post_analysis;
    v_summary text;
    v_description text;
    v_ocr_text text;
    v_tags text[] := '{}'::text[];
    v_topics text[] := '{}'::text[];
begin
    if p_outbox_id is null then
        raise exception 'p_outbox_id is required' using errcode = '22023';
    end if;
    if p_agent_identity is null or p_agent_identity !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'p_agent_identity is invalid' using errcode = '22023';
    end if;
    if p_result is null or jsonb_typeof(p_result) <> 'object' then
        raise exception 'p_result must be a JSON object' using errcode = '22023';
    end if;

    select outbox.user_id, outbox.aggregate_id, post.platform
    into v_user_id, v_post_id, v_platform
    from public.collection_capture_outbox outbox
    join public.collection_posts post
      on post.id = outbox.aggregate_id and post.user_id = outbox.user_id
    where outbox.id = p_outbox_id
      and outbox.aggregate_type = 'collection_post'
      and outbox.event_type = 'source.ingested.v1'
      and outbox.payload ->> 'source_type' = 'image_upload';

    if v_post_id is null or v_platform <> 'image' then
        raise exception 'Outbox item is not a direct image capture' using errcode = '22023';
    end if;

    v_summary := nullif(left(btrim(coalesce(p_result ->> 'summary', '')), 12000), '');
    v_description := nullif(left(btrim(coalesce(p_result ->> 'description', '')), 40000), '');
    v_ocr_text := nullif(left(btrim(coalesce(p_result ->> 'ocr_text', '')), 40000), '');
    if v_summary is null then
        raise exception 'p_result.summary is required' using errcode = '22023';
    end if;

    if jsonb_typeof(p_result -> 'tags') = 'array' then
        select coalesce(array_agg(left(tag, 80)), '{}'::text[])
        into v_tags
        from (
            select nullif(btrim(value), '') as tag
            from jsonb_array_elements_text(p_result -> 'tags')
            limit 25
        ) tag_rows
        where tag is not null;
    end if;
    if jsonb_typeof(p_result -> 'topics') = 'array' then
        select coalesce(array_agg(left(topic, 120)), '{}'::text[])
        into v_topics
        from (
            select nullif(btrim(value), '') as topic
            from jsonb_array_elements_text(p_result -> 'topics')
            limit 25
        ) topic_rows
        where topic is not null;
    end if;

    update public.collection_posts
    set content = coalesce(v_ocr_text, v_description, v_summary),
        updated_at = now()
    where id = v_post_id and user_id = v_user_id;

    update public.collection_post_analysis analysis
    set summary = v_summary,
        tags = v_tags,
        topics = v_topics,
        primary_category = coalesce(
            nullif(left(btrim(coalesce(p_result ->> 'primary_category', '')), 50), ''),
            analysis.primary_category,
            'other'
        ),
        sentiment = nullif(left(btrim(coalesce(p_result ->> 'sentiment', '')), 50), ''),
        insights = (
            select coalesce(jsonb_agg(item), '[]'::jsonb)
            from jsonb_array_elements(
                case when jsonb_typeof(analysis.insights) = 'array' then analysis.insights else '[]'::jsonb end
            ) item
            where coalesce(item ->> 'type', '') <> 'image_analysis'
               or coalesce(item ->> 'outbox_id', '') <> p_outbox_id::text
        ) || jsonb_build_array(jsonb_build_object(
            'type', 'image_analysis',
            'schema_version', 1,
            'outbox_id', p_outbox_id,
            'agent', p_agent_identity,
            'description', v_description,
            'ocr_text', v_ocr_text,
            'analyzed_at', now()
        )),
        updated_at = now()
    where analysis.post_id = v_post_id and analysis.user_id = v_user_id
    returning analysis.* into v_analysis;

    if v_analysis.id is null then
        raise exception 'Image analysis row was not found' using errcode = 'P0002';
    end if;
    return v_analysis;
end;
$$;

revoke all on function public.enqueue_collection_image_capture_request(
    uuid, text, text, text, bigint, text, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.enqueue_collection_image_capture_request(
    uuid, text, text, text, bigint, text, text, text, integer, jsonb
) to service_role;

revoke all on function public.record_collection_image_analysis(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.record_collection_image_analysis(uuid, text, jsonb)
to service_role;

revoke all on function public.finalize_collection_capture(
    uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.finalize_collection_capture(
    uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) to service_role;

commit;
