-- Stage C: Content Studio storage for outbox content routes.
-- Execute once in Supabase SQL Editor after Stage B source finalization.

begin;

create table if not exists public.content_assets (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_id uuid not null references public.collection_posts(id) on delete cascade,
    title text not null,
    format text not null check (format in ('x_thread', 'linkedin_post', 'blog_article', 'short_script', 'newsletter')),
    status text not null default 'draft' check (status in ('draft', 'review_pending', 'approved', 'published', 'archived')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint content_assets_user_source_format_unique unique (user_id, source_id, format)
);

comment on column public.content_assets.metadata is
    'Content provenance JSONB: route_type, source_url, attribution, key_takeaways array, generator identifier, and optional poc_run_id UUID. No credentials or user secrets.';

create index if not exists content_assets_user_id_idx on public.content_assets(user_id);
create index if not exists content_assets_source_id_idx on public.content_assets(source_id);

create table if not exists public.content_revisions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    content_asset_id uuid not null references public.content_assets(id) on delete cascade,
    revision_number integer not null check (revision_number > 0),
    idempotency_key text not null check (char_length(idempotency_key) between 1 and 256),
    body text not null,
    change_summary text,
    author_type text not null check (author_type in ('ai', 'user')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint content_revisions_asset_num_unique unique (content_asset_id, revision_number),
    constraint content_revisions_asset_idempotency_unique unique (content_asset_id, idempotency_key)
);

create index if not exists content_revisions_user_id_idx on public.content_revisions(user_id);

create table if not exists public.content_evidence_links (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    content_asset_id uuid not null references public.content_assets(id) on delete cascade,
    evidence_type text not null check (evidence_type in ('source_post', 'project_need', 'poc_result', 'code_diff')),
    target_id uuid not null,
    citation_text text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint content_evidence_links_unique unique (content_asset_id, evidence_type, target_id)
);

create index if not exists content_evidence_links_user_id_idx on public.content_evidence_links(user_id);

alter table public.content_assets enable row level security;
alter table public.content_revisions enable row level security;
alter table public.content_evidence_links enable row level security;

drop trigger if exists update_content_assets_updated_at on public.content_assets;
create trigger update_content_assets_updated_at
    before update on public.content_assets
    for each row execute procedure public.collection_update_updated_at_column();

drop trigger if exists update_content_revisions_updated_at on public.content_revisions;
create trigger update_content_revisions_updated_at
    before update on public.content_revisions
    for each row execute procedure public.collection_update_updated_at_column();

drop trigger if exists update_content_evidence_links_updated_at on public.content_evidence_links;
create trigger update_content_evidence_links_updated_at
    before update on public.content_evidence_links
    for each row execute procedure public.collection_update_updated_at_column();

revoke all on table public.content_assets, public.content_revisions, public.content_evidence_links from public, anon;
grant select, insert, update, delete on table public.content_assets, public.content_revisions, public.content_evidence_links to authenticated, service_role;

drop policy if exists content_assets_owner_policy on public.content_assets;
create policy content_assets_owner_policy on public.content_assets for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists content_revisions_owner_policy on public.content_revisions;
create policy content_revisions_owner_policy on public.content_revisions for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists content_evidence_links_owner_policy on public.content_evidence_links;
create policy content_evidence_links_owner_policy on public.content_evidence_links for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create or replace function public.store_content_draft(
    p_user_id uuid,
    p_source_id uuid,
    p_format text,
    p_title text,
    p_body text,
    p_metadata jsonb,
    p_idempotency_key text,
    p_poc_run_id uuid default null
)
returns table (
    content_asset_id uuid,
    content_revision_id uuid,
    revision_number integer,
    created boolean
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_asset_id uuid;
    v_revision_id uuid;
    v_revision_number integer;
begin
    if p_user_id is null or p_source_id is null or coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
        raise exception 'user_id, source_id, title and body are required';
    end if;

    insert into public.content_assets (user_id, source_id, title, format, metadata)
    values (p_user_id, p_source_id, p_title, p_format, coalesce(p_metadata, '{}'::jsonb))
    on conflict (user_id, source_id, format) do nothing
    returning id into v_asset_id;

    if v_asset_id is null then
        select asset.id into v_asset_id
        from public.content_assets as asset
        where asset.user_id = p_user_id
          and asset.source_id = p_source_id
          and asset.format = p_format
        for update;
    end if;

    select revision.id, revision.revision_number into v_revision_id, v_revision_number
    from public.content_revisions as revision
    where revision.content_asset_id = v_asset_id
      and revision.idempotency_key = p_idempotency_key;

    if v_revision_id is not null then
        return query select v_asset_id, v_revision_id, v_revision_number, false;
        return;
    end if;

    update public.content_assets as asset
    set title = p_title,
        metadata = coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
    where asset.id = v_asset_id;

    select coalesce(max(revision.revision_number), 0) + 1 into v_revision_number
    from public.content_revisions as revision
    where revision.content_asset_id = v_asset_id;

    insert into public.content_revisions (
        user_id, content_asset_id, revision_number, idempotency_key, body, change_summary, author_type
    )
    values (
        p_user_id, v_asset_id, v_revision_number, p_idempotency_key, p_body, 'Generated from outbox route', 'ai'
    )
    returning id into v_revision_id;

    insert into public.content_evidence_links (user_id, content_asset_id, evidence_type, target_id, citation_text)
    values (p_user_id, v_asset_id, 'source_post', p_source_id, 'Original captured source')
    on conflict (content_asset_id, evidence_type, target_id) do nothing;

    if p_poc_run_id is not null then
        insert into public.content_evidence_links (user_id, content_asset_id, evidence_type, target_id, citation_text)
        values (p_user_id, v_asset_id, 'poc_result', p_poc_run_id, 'Validated sandbox POC run')
        on conflict (content_asset_id, evidence_type, target_id) do nothing;
    end if;

    return query select v_asset_id, v_revision_id, v_revision_number, true;
end;
$$;

revoke all on function public.store_content_draft(uuid, uuid, text, text, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.store_content_draft(uuid, uuid, text, text, text, jsonb, text, uuid) to service_role;

commit;
