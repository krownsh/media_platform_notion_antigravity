-- Stage D: user-controlled topic scopes for collection folders.
-- Run once in Supabase SQL Editor after the base collection schema.

begin;

create table if not exists public.collection_topic_scopes (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    collection_id uuid not null references public.collection_collections(id) on delete cascade,
    mode text not null default 'collect' check (mode in ('collect', 'research', 'poc_proposal')),
    objective text,
    project_targets text[] not null default '{}'::text[],
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint collection_topic_scopes_user_collection_unique unique (user_id, collection_id)
);

comment on table public.collection_topic_scopes is
    'User-controlled action boundary for a collection folder. collect stores only; research creates a proposal; poc_proposal permits a proposal for explicitly listed project target aliases. It never authorizes automatic POC execution.';
comment on column public.collection_topic_scopes.project_targets is
    'Project target aliases that this topic may be matched against, for example media_platform_notion_antigravity. Empty means no project audit or POC proposal is allowed.';

create index if not exists collection_topic_scopes_user_active_idx
    on public.collection_topic_scopes (user_id, is_active);

alter table public.collection_topic_scopes enable row level security;

drop trigger if exists update_collection_topic_scopes_updated_at on public.collection_topic_scopes;
create trigger update_collection_topic_scopes_updated_at
    before update on public.collection_topic_scopes
    for each row execute procedure public.collection_update_updated_at_column();

revoke all on table public.collection_topic_scopes from public, anon;
grant select, insert, update, delete on table public.collection_topic_scopes to authenticated, service_role;

drop policy if exists collection_topic_scopes_owner_policy on public.collection_topic_scopes;
create policy collection_topic_scopes_owner_policy on public.collection_topic_scopes for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

commit;
