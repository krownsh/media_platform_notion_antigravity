-- Owner-guided candidate work queue and automatic retrieval metadata.
-- Collection-only. It creates no trigger which accepts, promotes, moves, or
-- deletes Owner knowledge. Apply after the stage_x owner-guided deployments.
begin;

create table if not exists public.owner_candidate_generation_jobs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    post_id uuid not null references public.collection_posts(id) on delete cascade,
    source_revision_id uuid not null references public.collection_source_revisions(id) on delete cascade,
    review_packet_id uuid not null references public.owner_review_packets(id) on delete cascade,
    status text not null check (status in ('pending','processing','completed','failed','rate_limited','waiting_source_repair')),
    attempts integer not null default 0 check (attempts >= 0),
    available_at timestamptz not null default now(),
    lease_key text,
    leased_at timestamptz,
    completed_at timestamptz,
    last_error text,
    agent_version text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, source_revision_id),
    unique (review_packet_id)
);
comment on table public.owner_candidate_generation_jobs is
    'Durable handoff for external reasoning. A completed job may create candidate drafts and retrieval terms, never accepted knowledge.';

create table if not exists public.owner_candidate_generation_control (
    user_id uuid primary key references auth.users(id) on delete cascade,
    blocked_until timestamptz,
    last_rate_limit_at timestamptz,
    last_run_key text,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);
comment on table public.owner_candidate_generation_control is
    'Owner-scoped circuit breaker. A 429 blocks new claims until blocked_until; it does not alter any source or candidate decision.';

create table if not exists public.owner_post_retrieval_terms (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    post_id uuid not null references public.collection_posts(id) on delete cascade,
    source_revision_id uuid references public.collection_source_revisions(id) on delete cascade,
    term text not null check (char_length(btrim(term)) between 1 and 240),
    normalized_term text not null check (char_length(btrim(normalized_term)) between 1 and 240),
    term_kind text not null check (term_kind in ('source_keyword','entity','alias','memory_cue','discussion_cue','formal_knowledge')),
    visibility text not null default 'active' check (visibility in ('active','hidden')),
    evidence_excerpt text not null check (char_length(btrim(evidence_excerpt)) between 1 and 1000),
    origin text not null check (origin in ('captured_source','post_discussion','accepted_knowledge','agent_candidate')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, post_id, normalized_term, term_kind)
);
comment on table public.owner_post_retrieval_terms is
    'Automatic, explainable retrieval clues. They help find a post but are not a folder, Topic, post note, or accepted knowledge.';

create index if not exists owner_candidate_generation_jobs_claim_idx on public.owner_candidate_generation_jobs (user_id, status, available_at, created_at);
create index if not exists owner_post_retrieval_terms_lookup_idx on public.owner_post_retrieval_terms (user_id, post_id, visibility, updated_at desc);
create index if not exists owner_post_retrieval_terms_normalized_idx on public.owner_post_retrieval_terms (user_id, normalized_term) where visibility = 'active';

alter table public.owner_candidate_generation_jobs enable row level security;
alter table public.owner_candidate_generation_control enable row level security;
alter table public.owner_post_retrieval_terms enable row level security;
drop policy if exists "Owners view their candidate generation jobs" on public.owner_candidate_generation_jobs;
create policy "Owners view their candidate generation jobs" on public.owner_candidate_generation_jobs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Owners view their candidate generation control" on public.owner_candidate_generation_control;
create policy "Owners view their candidate generation control" on public.owner_candidate_generation_control for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Owners view their retrieval terms" on public.owner_post_retrieval_terms;
create policy "Owners view their retrieval terms" on public.owner_post_retrieval_terms for select to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.owner_candidate_generation_jobs, public.owner_candidate_generation_control, public.owner_post_retrieval_terms from anon, authenticated;
grant select on table public.owner_candidate_generation_jobs, public.owner_candidate_generation_control, public.owner_post_retrieval_terms to authenticated;
grant select, insert, update, delete on table public.owner_candidate_generation_jobs, public.owner_candidate_generation_control, public.owner_post_retrieval_terms to service_role;

drop trigger if exists update_owner_candidate_generation_jobs_updated_at on public.owner_candidate_generation_jobs;
create trigger update_owner_candidate_generation_jobs_updated_at before update on public.owner_candidate_generation_jobs for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_candidate_generation_control_updated_at on public.owner_candidate_generation_control;
create trigger update_owner_candidate_generation_control_updated_at before update on public.owner_candidate_generation_control for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_post_retrieval_terms_updated_at on public.owner_post_retrieval_terms;
create trigger update_owner_post_retrieval_terms_updated_at before update on public.owner_post_retrieval_terms for each row execute procedure public.collection_update_updated_at_column();

create or replace function public.enqueue_owner_candidate_generation_job(
    p_user_id uuid, p_source_revision_id uuid, p_review_packet_id uuid, p_initial_status text
) returns public.owner_candidate_generation_jobs
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_post_id uuid; v_job public.owner_candidate_generation_jobs;
begin
    if p_initial_status not in ('pending','waiting_source_repair') then raise exception 'p_initial_status is invalid' using errcode = '22023'; end if;
    select post_id into v_post_id from public.collection_source_revisions where id = p_source_revision_id and user_id = p_user_id;
    if v_post_id is null then raise exception 'CANDIDATE_SOURCE_NOT_FOUND' using errcode = 'P0001'; end if;
    perform 1 from public.owner_review_packets where id = p_review_packet_id and user_id = p_user_id and source_revision_id = p_source_revision_id;
    if not found then raise exception 'CANDIDATE_PACKET_NOT_FOUND' using errcode = 'P0001'; end if;
    insert into public.owner_candidate_generation_jobs (user_id,post_id,source_revision_id,review_packet_id,status)
    values (p_user_id,v_post_id,p_source_revision_id,p_review_packet_id,p_initial_status)
    on conflict (user_id,source_revision_id) do update set
      status = case when owner_candidate_generation_jobs.status = 'waiting_source_repair' and excluded.status = 'pending' then 'pending' else owner_candidate_generation_jobs.status end,
      available_at = case when owner_candidate_generation_jobs.status = 'waiting_source_repair' and excluded.status = 'pending' then now() else owner_candidate_generation_jobs.available_at end
    returning * into v_job;
    return v_job;
end; $$;

create or replace function public.claim_owner_candidate_generation_jobs(
    p_user_id uuid, p_run_key text, p_limit integer default 20
) returns setof public.owner_candidate_generation_jobs
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_blocked_until timestamptz;
begin
    if p_user_id is null or nullif(btrim(p_run_key),'') is null then raise exception 'p_user_id and p_run_key are required' using errcode = '22023'; end if;
    if p_limit is null or p_limit < 1 or p_limit > 20 then raise exception 'p_limit must be between 1 and 20' using errcode = '22023'; end if;
    insert into public.owner_candidate_generation_control (user_id,last_run_key) values (p_user_id,btrim(p_run_key)) on conflict (user_id) do update set last_run_key=excluded.last_run_key,updated_at=now();
    select blocked_until into v_blocked_until from public.owner_candidate_generation_control where user_id = p_user_id for update;
    if v_blocked_until is not null and v_blocked_until > now() then return; end if;
    return query
      with claimed as (
        select id from public.owner_candidate_generation_jobs
        where user_id=p_user_id and status in ('pending','failed','rate_limited') and available_at <= now()
        order by created_at asc for update skip locked limit p_limit
      )
      update public.owner_candidate_generation_jobs j set status='processing', attempts=j.attempts+1, lease_key=btrim(p_run_key), leased_at=now(), last_error=null, updated_at=now()
      from claimed where j.id=claimed.id returning j.*;
end; $$;

create or replace function public.complete_owner_candidate_generation_job(
    p_user_id uuid, p_job_id uuid, p_run_key text, p_agent_version text default null
) returns public.owner_candidate_generation_jobs
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_job public.owner_candidate_generation_jobs;
begin
    update public.owner_candidate_generation_jobs set status='completed', completed_at=now(), agent_version=nullif(left(btrim(coalesce(p_agent_version,'')),120),''), updated_at=now()
    where id=p_job_id and user_id=p_user_id and status='processing' and lease_key=btrim(p_run_key) returning * into v_job;
    if v_job.id is null then raise exception 'CANDIDATE_JOB_LEASE_CONFLICT' using errcode = 'P0001'; end if;
    return v_job;
end; $$;

create or replace function public.complete_owner_content_discussion_checkpoint(
    p_user_id uuid, p_packet_id uuid, p_context jsonb default '{}'::jsonb
) returns public.owner_review_checkpoints
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_checkpoint public.owner_review_checkpoints;
begin
    if p_user_id is null or p_packet_id is null or jsonb_typeof(coalesce(p_context,'{}'::jsonb)) <> 'object' then raise exception 'owner, packet, and object context are required' using errcode = '22023'; end if;
    perform 1 from public.owner_review_packets where id=p_packet_id and user_id=p_user_id;
    if not found then raise exception 'CONTENT_DISCUSSION_PACKET_NOT_FOUND' using errcode = 'P0001'; end if;
    insert into public.owner_review_checkpoints (user_id,packet_id,checkpoint_key,status,context)
    values (p_user_id,p_packet_id,'content_discussion','completed',p_context || jsonb_build_object('schema_version',1,'recorded_at',now()))
    on conflict (packet_id,checkpoint_key) do update set status='completed',context=excluded.context,updated_at=now()
    returning * into v_checkpoint;
    insert into public.owner_review_audit_events (user_id,packet_id,event_type,actor_id,event_data)
    values (p_user_id,p_packet_id,'content_discussion.completed',p_user_id,jsonb_build_object('schema_version',1));
    return v_checkpoint;
end; $$;

create or replace function public.rate_limit_owner_candidate_generation_run(
    p_user_id uuid, p_run_key text, p_cooldown_seconds integer default 3600
) returns timestamptz
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_until timestamptz;
begin
    if p_cooldown_seconds is null or p_cooldown_seconds < 60 or p_cooldown_seconds > 86400 then raise exception 'p_cooldown_seconds must be between 60 and 86400' using errcode = '22023'; end if;
    v_until := now() + make_interval(secs => p_cooldown_seconds);
    insert into public.owner_candidate_generation_control (user_id,blocked_until,last_rate_limit_at,last_run_key) values (p_user_id,v_until,now(),btrim(p_run_key))
      on conflict (user_id) do update set blocked_until=excluded.blocked_until,last_rate_limit_at=excluded.last_rate_limit_at,last_run_key=excluded.last_run_key,updated_at=now();
    update public.owner_candidate_generation_jobs set status='rate_limited',available_at=v_until,last_error='rate_limited',updated_at=now()
      where user_id=p_user_id and status='processing' and lease_key=btrim(p_run_key);
    return v_until;
end; $$;

alter table public.owner_post_search_documents add column if not exists retrieval_text text not null default '';
alter table public.owner_post_search_documents add column if not exists retrieval_reasons text[] not null default '{}'::text[];
alter table public.owner_post_search_documents add column if not exists retrieval_vector tsvector generated always as (to_tsvector('simple', retrieval_text)) stored;
create index if not exists owner_post_search_documents_retrieval_vector_idx on public.owner_post_search_documents using gin (retrieval_vector);
create index if not exists owner_post_search_documents_retrieval_trgm_idx on public.owner_post_search_documents using gin (retrieval_text gin_trgm_ops);

create or replace function public.upsert_owner_post_search_document(
    p_user_id uuid, p_post_id uuid, p_source_revision_id uuid, p_source_quality text,
    p_title text, p_raw_text text, p_formal_text text, p_candidate_text text,
    p_retrieval_text text, p_formal_reasons text[] default '{}', p_candidate_reasons text[] default '{}', p_retrieval_reasons text[] default '{}'
) returns public.owner_post_search_documents
language plpgsql security invoker set search_path = public, pg_temp as $$
declare result_row public.owner_post_search_documents;
begin
    if p_user_id is null or p_post_id is null then raise exception 'p_user_id and p_post_id are required' using errcode = '22023'; end if;
    if p_source_quality is not null and p_source_quality not in ('complete','partial') then raise exception 'p_source_quality is invalid' using errcode = '22023'; end if;
    insert into public.owner_post_search_documents (post_id,user_id,source_revision_id,source_quality,title,raw_text,formal_text,candidate_text,retrieval_text,formal_reasons,candidate_reasons,retrieval_reasons,updated_at,indexed_at)
    values (p_post_id,p_user_id,p_source_revision_id,p_source_quality,left(coalesce(p_title,''),500),left(coalesce(p_raw_text,''),120000),left(coalesce(p_formal_text,''),120000),left(coalesce(p_candidate_text,''),120000),left(coalesce(p_retrieval_text,''),120000),coalesce(p_formal_reasons,'{}'),coalesce(p_candidate_reasons,'{}'),coalesce(p_retrieval_reasons,'{}'),now(),now())
    on conflict (post_id) do update set source_revision_id=excluded.source_revision_id,source_quality=excluded.source_quality,title=excluded.title,raw_text=excluded.raw_text,formal_text=excluded.formal_text,candidate_text=excluded.candidate_text,retrieval_text=excluded.retrieval_text,formal_reasons=excluded.formal_reasons,candidate_reasons=excluded.candidate_reasons,retrieval_reasons=excluded.retrieval_reasons,updated_at=now(),indexed_at=now()
    returning * into result_row;
    return result_row;
end; $$;

create or replace function public.search_owner_post_documents(p_user_id uuid, p_query text default null, p_limit integer default 30, p_include_candidates boolean default false)
returns table (post_id uuid, score real, title text, source_quality text, preview text, why_matched text[], candidate_only boolean, updated_at timestamptz)
language sql security invoker set search_path = public, pg_temp as $$
with input as (select lower(nullif(btrim(coalesce(p_query,'')),'')) q), rows as (
 select d.*, input.q,
   case when input.q is null then 0::real else greatest(similarity(lower(d.raw_text || E'\n' || d.formal_text || E'\n' || d.retrieval_text),input.q)::real,case when p_include_candidates then similarity(lower(d.candidate_text),input.q)::real else 0::real end) end score_value,
   position(input.q in lower(d.raw_text)) > 0 raw_hit, position(input.q in lower(d.formal_text)) > 0 formal_hit, position(input.q in lower(d.retrieval_text)) > 0 retrieval_hit, position(input.q in lower(d.candidate_text)) > 0 candidate_hit
 from public.owner_post_search_documents d cross join input
 where d.user_id=p_user_id and (input.q is null or position(input.q in lower(d.raw_text || E'\n' || d.formal_text || E'\n' || d.retrieval_text)) > 0 or (p_include_candidates and position(input.q in lower(d.candidate_text)) > 0))
)
select post_id,score_value,title,source_quality,left(case when q is null or raw_hit then raw_text when formal_hit then formal_text when retrieval_hit then retrieval_text else candidate_text end,420),
 case when q is null then array['raw_source'] when raw_hit then array['raw_source'] when formal_hit then coalesce(nullif(formal_reasons,'{}'),array['accepted_knowledge']) when retrieval_hit then coalesce(nullif(retrieval_reasons,'{}'),array['retrieval_term']) when candidate_hit and p_include_candidates then coalesce(nullif(candidate_reasons,'{}'),array['candidate']) else '{}'::text[] end,
 candidate_hit and not raw_hit and not formal_hit and not retrieval_hit,updated_at from rows order by score_value desc,updated_at desc limit greatest(1,least(coalesce(p_limit,30),100));
$$;

revoke all on function public.enqueue_owner_candidate_generation_job(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.claim_owner_candidate_generation_jobs(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.complete_owner_candidate_generation_job(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.rate_limit_owner_candidate_generation_run(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.complete_owner_content_discussion_checkpoint(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.upsert_owner_post_search_document(uuid,uuid,uuid,text,text,text,text,text,text,text[],text[],text[]) from public, anon, authenticated;
grant execute on function public.enqueue_owner_candidate_generation_job(uuid,uuid,uuid,text), public.claim_owner_candidate_generation_jobs(uuid,text,integer), public.complete_owner_candidate_generation_job(uuid,uuid,text,text), public.rate_limit_owner_candidate_generation_run(uuid,text,integer), public.upsert_owner_post_search_document(uuid,uuid,uuid,text,text,text,text,text,text,text[],text[],text[]) to service_role;
grant execute on function public.complete_owner_content_discussion_checkpoint(uuid,uuid,jsonb) to service_role;
commit;
