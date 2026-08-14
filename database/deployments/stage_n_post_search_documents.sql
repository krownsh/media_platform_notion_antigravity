-- Stage N: no-vector memory search for captured posts.
--
-- The search document is a denormalized, user-owned projection. Supabase
-- remains the source of truth; this table only makes lexical retrieval fast
-- and explainable. It deliberately does not use pgvector or embeddings.

begin;

create extension if not exists pg_trgm;

create table if not exists public.collection_post_search_documents (
    post_id uuid primary key references public.collection_posts(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null default '',
    author_name text not null default '',
    platform text not null default 'generic',
    source_url text,
    collection_id uuid,
    workflow_stage text,
    workflow_status text,
    search_text text not null default '',
    keywords text[] not null default '{}',
    entities text[] not null default '{}',
    aliases text[] not null default '{}',
    memory_cues text[] not null default '{}',
    search_vector tsvector generated always as (
        to_tsvector('simple', coalesce(search_text, ''))
    ) stored,
    updated_at timestamptz not null default now(),
    indexed_at timestamptz not null default now()
);

comment on table public.collection_post_search_documents is
    'Lexical search projection for Collection posts. No embeddings or vector search.';
comment on column public.collection_post_search_documents.memory_cues is
    'Natural-language recall phrases such as "那個可以讓照片開口說話的工具".';

create index if not exists collection_post_search_documents_user_updated_idx
    on public.collection_post_search_documents (user_id, updated_at desc, post_id desc);
create index if not exists collection_post_search_documents_keywords_gin_idx
    on public.collection_post_search_documents using gin (keywords);
create index if not exists collection_post_search_documents_entities_gin_idx
    on public.collection_post_search_documents using gin (entities);
create index if not exists collection_post_search_documents_aliases_gin_idx
    on public.collection_post_search_documents using gin (aliases);
create index if not exists collection_post_search_documents_memory_cues_gin_idx
    on public.collection_post_search_documents using gin (memory_cues);
create index if not exists collection_post_search_documents_vector_gin_idx
    on public.collection_post_search_documents using gin (search_vector);
create index if not exists collection_post_search_documents_text_trgm_idx
    on public.collection_post_search_documents using gin (search_text gin_trgm_ops);

alter table public.collection_post_search_documents enable row level security;

drop policy if exists collection_post_search_documents_owner_select
    on public.collection_post_search_documents;
create policy collection_post_search_documents_owner_select
    on public.collection_post_search_documents for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists collection_post_search_documents_owner_write
    on public.collection_post_search_documents;
create policy collection_post_search_documents_owner_write
    on public.collection_post_search_documents for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

revoke all on table public.collection_post_search_documents from public, anon;
grant select on table public.collection_post_search_documents to authenticated;
grant select, insert, update, delete on table public.collection_post_search_documents to service_role;

create or replace function public.upsert_collection_post_search_document(
    p_user_id uuid,
    p_post_id uuid,
    p_title text default '',
    p_author_name text default '',
    p_platform text default 'generic',
    p_source_url text default null,
    p_collection_id uuid default null,
    p_workflow_stage text default null,
    p_workflow_status text default null,
    p_search_text text default '',
    p_keywords text[] default '{}',
    p_entities text[] default '{}',
    p_aliases text[] default '{}',
    p_memory_cues text[] default '{}'
)
returns public.collection_post_search_documents
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    result_row public.collection_post_search_documents;
begin
    if p_user_id is null or p_post_id is null then
        raise exception 'user_id and post_id are required' using errcode = '22023';
    end if;

    insert into public.collection_post_search_documents (
        post_id, user_id, title, author_name, platform, source_url,
        collection_id, workflow_stage, workflow_status, search_text,
        keywords, entities, aliases, memory_cues, updated_at, indexed_at
    ) values (
        p_post_id,
        p_user_id,
        left(coalesce(p_title, ''), 500),
        left(coalesce(p_author_name, ''), 255),
        left(coalesce(p_platform, 'generic'), 50),
        nullif(left(coalesce(p_source_url, ''), 4_000), ''),
        p_collection_id,
        nullif(left(coalesce(p_workflow_stage, ''), 50), ''),
        nullif(left(coalesce(p_workflow_status, ''), 50), ''),
        left(coalesce(p_search_text, ''), 120_000),
        coalesce(p_keywords, '{}'),
        coalesce(p_entities, '{}'),
        coalesce(p_aliases, '{}'),
        coalesce(p_memory_cues, '{}'),
        now(),
        now()
    )
    on conflict (post_id) do update set
        user_id = excluded.user_id,
        title = excluded.title,
        author_name = excluded.author_name,
        platform = excluded.platform,
        source_url = excluded.source_url,
        collection_id = excluded.collection_id,
        workflow_stage = excluded.workflow_stage,
        workflow_status = excluded.workflow_status,
        search_text = excluded.search_text,
        keywords = excluded.keywords,
        entities = excluded.entities,
        aliases = excluded.aliases,
        memory_cues = excluded.memory_cues,
        updated_at = now(),
        indexed_at = now()
    returning * into result_row;

    return result_row;
end;
$$;

revoke all on function public.upsert_collection_post_search_document(
    uuid, uuid, text, text, text, text, uuid, text, text, text,
    text[], text[], text[], text[]
) from public, anon, authenticated;
grant execute on function public.upsert_collection_post_search_document(
    uuid, uuid, text, text, text, text, uuid, text, text, text,
    text[], text[], text[], text[]
) to service_role;

create or replace function public.search_collection_post_documents(
    p_user_id uuid,
    p_query text default null,
    p_limit integer default 30,
    p_platform text default null,
    p_collection_id uuid default null,
    p_workflow_stage text default null,
    p_workflow_status text default null
)
returns table (
    post_id uuid,
    score real,
    title text,
    author_name text,
    platform text,
    source_url text,
    collection_id uuid,
    workflow_stage text,
    workflow_status text,
    preview text,
    keywords text[],
    entities text[],
    aliases text[],
    memory_cues text[],
    updated_at timestamptz
)
language sql
security invoker
set search_path = public, pg_temp
as $$
with input as (
    select
        nullif(btrim(coalesce(p_query, '')), '') as query_text,
        plainto_tsquery('simple', nullif(btrim(coalesce(p_query, '')), '')) as query_ts
), ranked as (
    select
        document.*,
        case
            when input.query_text is null then 0::real
            else greatest(
                case when lower(document.title) = lower(input.query_text) then 100::real else 0::real end,
                case when exists (select 1 from unnest(document.aliases) as term where lower(term) = lower(input.query_text)) then 85::real else 0::real end,
                coalesce(ts_rank_cd(document.search_vector, input.query_ts) * 60, 0)::real,
                coalesce(similarity(document.search_text, input.query_text) * 40, 0)::real
            )
        end as result_score
    from public.collection_post_search_documents as document
    cross join input
    where document.user_id = p_user_id
      and (p_platform is null or document.platform = p_platform)
      and (p_collection_id is null or document.collection_id = p_collection_id)
      and (p_workflow_stage is null or document.workflow_stage = p_workflow_stage)
      and (p_workflow_status is null or document.workflow_status = p_workflow_status)
      and (
          input.query_text is null
          or document.search_vector @@ input.query_ts
          or document.search_text % input.query_text
          or exists (select 1 from unnest(document.keywords) as term where lower(term) = lower(input.query_text))
          or exists (select 1 from unnest(document.entities) as term where lower(term) = lower(input.query_text))
          or exists (select 1 from unnest(document.aliases) as term where lower(term) = lower(input.query_text))
          or exists (select 1 from unnest(document.memory_cues) as term where lower(term) = lower(input.query_text))
          or position(lower(input.query_text) in lower(document.search_text)) > 0
      )
)
select
    ranked.post_id,
    ranked.result_score as score,
    ranked.title,
    ranked.author_name,
    ranked.platform,
    ranked.source_url,
    ranked.collection_id,
    ranked.workflow_stage,
    ranked.workflow_status,
    left(ranked.search_text, 420) as preview,
    ranked.keywords,
    ranked.entities,
    ranked.aliases,
    ranked.memory_cues,
    ranked.updated_at
from ranked
order by ranked.result_score desc, ranked.updated_at desc, ranked.post_id desc
limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.search_collection_post_documents(
    uuid, text, integer, text, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.search_collection_post_documents(
    uuid, text, integer, text, uuid, text, text
) to service_role;

commit;
