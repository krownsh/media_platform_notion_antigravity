-- Owner-guided Library search (M5). Apply after M4.
begin;

create extension if not exists pg_trgm;

create table if not exists public.owner_post_search_documents (
    post_id uuid primary key references public.collection_posts(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    source_revision_id uuid references public.collection_source_revisions(id) on delete set null,
    source_quality text check (source_quality in ('complete', 'partial')),
    title text not null default '',
    raw_text text not null default '',
    formal_text text not null default '',
    candidate_text text not null default '',
    formal_reasons text[] not null default '{}'::text[],
    candidate_reasons text[] not null default '{}'::text[],
    raw_vector tsvector generated always as (to_tsvector('simple', raw_text || E'\n' || formal_text)) stored,
    candidate_vector tsvector generated always as (to_tsvector('simple', candidate_text)) stored,
    updated_at timestamptz not null default now(),
    indexed_at timestamptz not null default now()
);
comment on table public.owner_post_search_documents is
    'Rebuildable owner-guided search projection. raw_text is captured evidence; formal_text contains accepted-only enrichment; candidate_text is excluded unless explicitly requested.';

create index if not exists owner_post_search_documents_user_updated_idx on public.owner_post_search_documents (user_id, updated_at desc);
create index if not exists owner_post_search_documents_raw_vector_idx on public.owner_post_search_documents using gin (raw_vector);
create index if not exists owner_post_search_documents_candidate_vector_idx on public.owner_post_search_documents using gin (candidate_vector);
create index if not exists owner_post_search_documents_raw_trgm_idx on public.owner_post_search_documents using gin ((raw_text || E'\n' || formal_text) gin_trgm_ops);

alter table public.owner_post_search_documents enable row level security;
drop policy if exists "Owners view their guided search documents" on public.owner_post_search_documents;
create policy "Owners view their guided search documents" on public.owner_post_search_documents for select to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.owner_post_search_documents from anon, authenticated;
grant select on table public.owner_post_search_documents to authenticated;
grant select, insert, update, delete on table public.owner_post_search_documents to service_role;

create or replace function public.upsert_owner_post_search_document(
    p_user_id uuid, p_post_id uuid, p_source_revision_id uuid, p_source_quality text,
    p_title text, p_raw_text text, p_formal_text text, p_candidate_text text,
    p_formal_reasons text[] default '{}', p_candidate_reasons text[] default '{}'
) returns public.owner_post_search_documents
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare result_row public.owner_post_search_documents;
begin
    if p_user_id is null or p_post_id is null then raise exception 'p_user_id and p_post_id are required' using errcode = '22023'; end if;
    if p_source_quality is not null and p_source_quality not in ('complete', 'partial') then raise exception 'p_source_quality is invalid' using errcode = '22023'; end if;
    insert into public.owner_post_search_documents (post_id,user_id,source_revision_id,source_quality,title,raw_text,formal_text,candidate_text,formal_reasons,candidate_reasons,updated_at,indexed_at)
    values (p_post_id,p_user_id,p_source_revision_id,p_source_quality,left(coalesce(p_title,''),500),left(coalesce(p_raw_text,''),120000),left(coalesce(p_formal_text,''),120000),left(coalesce(p_candidate_text,''),120000),coalesce(p_formal_reasons,'{}'),coalesce(p_candidate_reasons,'{}'),now(),now())
    on conflict (post_id) do update set source_revision_id=excluded.source_revision_id,source_quality=excluded.source_quality,title=excluded.title,raw_text=excluded.raw_text,formal_text=excluded.formal_text,candidate_text=excluded.candidate_text,formal_reasons=excluded.formal_reasons,candidate_reasons=excluded.candidate_reasons,updated_at=now(),indexed_at=now()
    returning * into result_row;
    return result_row;
end;
$$;

create or replace function public.search_owner_post_documents(p_user_id uuid, p_query text default null, p_limit integer default 30, p_include_candidates boolean default false)
returns table (post_id uuid, score real, title text, source_quality text, preview text, why_matched text[], candidate_only boolean, updated_at timestamptz)
language sql security invoker set search_path = public, pg_temp
as $$
with input as (select lower(nullif(btrim(coalesce(p_query,'')),'')) q), rows as (
 select d.*, input.q,
   case when input.q is null then 0::real else greatest(similarity(lower(d.raw_text || E'\n' || d.formal_text), input.q)::real, case when p_include_candidates then similarity(lower(d.candidate_text), input.q)::real else 0::real end) end score_value,
   position(input.q in lower(d.raw_text)) > 0 as raw_hit,
   position(input.q in lower(d.formal_text)) > 0 as formal_hit,
   position(input.q in lower(d.candidate_text)) > 0 as candidate_hit
 from public.owner_post_search_documents d cross join input
 where d.user_id=p_user_id and (input.q is null or position(input.q in lower(d.raw_text || E'\n' || d.formal_text)) > 0 or (p_include_candidates and position(input.q in lower(d.candidate_text)) > 0))
)
select post_id, score_value, title, source_quality, left(case when q is null then raw_text when raw_hit then raw_text when formal_hit then formal_text when candidate_hit and p_include_candidates then candidate_text else raw_text end,420),
 case
   when q is null then array['raw_source']
   when raw_hit then array['raw_source'] || case when formal_hit then formal_reasons else '{}'::text[] end
   when formal_hit then case when cardinality(formal_reasons) > 0 then formal_reasons else array['accepted_knowledge'] end
   when candidate_hit and p_include_candidates then case when cardinality(candidate_reasons) > 0 then candidate_reasons else array['candidate'] end
   else '{}'::text[]
 end,
 candidate_hit and not raw_hit and not formal_hit, updated_at
from rows order by score_value desc, updated_at desc limit greatest(1,least(coalesce(p_limit,30),100));
$$;

revoke all on function public.upsert_owner_post_search_document(uuid,uuid,uuid,text,text,text,text,text,text[],text[]) from public, anon, authenticated;
grant execute on function public.upsert_owner_post_search_document(uuid,uuid,uuid,text,text,text,text,text,text[],text[]) to service_role;
revoke all on function public.search_owner_post_documents(uuid,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.search_owner_post_documents(uuid,text,integer,boolean) to service_role;
commit;
