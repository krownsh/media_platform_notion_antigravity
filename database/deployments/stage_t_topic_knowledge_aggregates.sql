-- Stage T: controlled, revisioned knowledge aggregates on user-owned topics.
--
-- Aggregate fields are system-maintained snapshots derived only from explicitly
-- accepted source matches. They never overwrite human-authored purpose,
-- description, keywords, or desired_outcomes.

begin;

alter table public.collection_topics
    add column if not exists knowledge_summary text not null default '',
    add column if not exists knowledge_concepts jsonb not null default '[]'::jsonb,
    add column if not exists knowledge_open_questions jsonb not null default '[]'::jsonb,
    add column if not exists knowledge_source_ids uuid[] not null default '{}'::uuid[],
    add column if not exists knowledge_source_count integer not null default 0,
    add column if not exists knowledge_revision integer not null default 0,
    add column if not exists knowledge_aggregated_at timestamptz;

alter table public.collection_topics
    drop constraint if exists collection_topics_knowledge_concepts_array_check,
    add constraint collection_topics_knowledge_concepts_array_check
        check (jsonb_typeof(knowledge_concepts) = 'array'),
    drop constraint if exists collection_topics_knowledge_open_questions_array_check,
    add constraint collection_topics_knowledge_open_questions_array_check
        check (jsonb_typeof(knowledge_open_questions) = 'array'),
    drop constraint if exists collection_topics_knowledge_source_count_check,
    add constraint collection_topics_knowledge_source_count_check
        check (knowledge_source_count >= 0),
    drop constraint if exists collection_topics_knowledge_revision_check,
    add constraint collection_topics_knowledge_revision_check
        check (knowledge_revision >= 0);

create index if not exists collection_topics_knowledge_aggregate_active_idx
    on public.collection_topics (user_id, project_id, knowledge_revision desc, updated_at desc)
    where status = 'active';

comment on column public.collection_topics.knowledge_summary is
    'System-maintained aggregate derived from accepted source matches; separate from human description.';
comment on column public.collection_topics.knowledge_concepts is
    'JSON array of normalized knowledge concepts derived from accepted source evidence.';
comment on column public.collection_topics.knowledge_open_questions is
    'JSON array of unresolved questions derived from accepted source evidence.';
comment on column public.collection_topics.knowledge_source_ids is
    'Accepted source-id snapshot used to produce the current aggregate revision.';
comment on column public.collection_topics.knowledge_revision is
    'Monotonic revision of the controlled aggregate, incremented only by aggregate rebuilds.';

commit;
