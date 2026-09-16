-- Stage V: DB-backed, read-only collection knowledge-map projections.
--
-- This table is a reader projection. It stores generated conclusions with their
-- per-statement source citations; it never replaces collection_posts or edits
-- a user's original saved post.

begin;

create table if not exists public.collection_knowledge_maps (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    collection_id uuid not null references public.collection_collections(id) on delete cascade,
    source_run_id text,
    status text not null default 'partial' check (status in ('partial', 'complete', 'failed')),
    question text not null default '',
    caveat text not null default '',
    statements jsonb not null default '[]'::jsonb,
    processed_posts integer not null default 0 check (processed_posts >= 0),
    total_posts integer not null default 0 check (total_posts >= 0),
    revision integer not null default 1 check (revision >= 1),
    generated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint collection_knowledge_maps_processed_within_total
        check (processed_posts <= total_posts),
    constraint collection_knowledge_maps_statements_array
        check (jsonb_typeof(statements) = 'array'),
    constraint collection_knowledge_maps_user_collection_unique unique (user_id, collection_id)
);

comment on table public.collection_knowledge_maps is
    'Read-only, user-owned collection knowledge-map projection. Conclusions retain per-statement collection_posts citations.';
comment on column public.collection_knowledge_maps.statements is
    'JSON array: text, optional detail, and non-empty citations with post_id, title, excerpt, evidence_status.';
comment on column public.collection_knowledge_maps.source_run_id is
    'Optional provenance of the import/generation run; never used as a runtime file path.';

create index if not exists collection_knowledge_maps_user_collection_idx
    on public.collection_knowledge_maps (user_id, collection_id, updated_at desc);

alter table public.collection_knowledge_maps enable row level security;

create policy collection_knowledge_maps_owner_read on public.collection_knowledge_maps
    for select to authenticated
    using ((select auth.uid()) = user_id);

drop trigger if exists update_collection_knowledge_maps_updated_at on public.collection_knowledge_maps;
create trigger update_collection_knowledge_maps_updated_at
    before update on public.collection_knowledge_maps
    for each row execute procedure public.collection_update_updated_at_column();

commit;
