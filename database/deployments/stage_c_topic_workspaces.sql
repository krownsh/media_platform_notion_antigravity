-- Stage C: human-managed Topic workspaces for the Knowledge-Action Vault.
--
-- Deployment source only; apply after Stage B. This script does not create
-- topics automatically. Agent-created candidates must use origin =
-- 'agent_proposal' and status = 'proposed' until a user accepts them.

begin;

create table if not exists public.collection_topics (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    slug text not null,
    title text not null,
    description text,
    purpose text,
    desired_outcomes text[] not null default '{}'::text[],
    keywords text[] not null default '{}'::text[],
    origin text not null default 'user' check (origin in ('user', 'agent_proposal')),
    status text not null default 'active' check (status in ('proposed', 'active', 'paused', 'archived')),
    agent_confidence numeric(5,2) check (agent_confidence between 0 and 100),
    proposal_evidence jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint collection_topics_user_slug_unique unique (user_id, slug),
    constraint collection_topics_agent_proposal_needs_proposed
        check (origin <> 'agent_proposal' or status = 'proposed')
);

comment on table public.collection_topics is
    'User-owned Topic workspaces. Agent-created records remain proposals until the user accepts them.';
comment on column public.collection_topics.proposal_evidence is
    'JSONB evidence for an agent proposal: source_ids, repeated_terms, rationale, and optional confidence inputs.';

create index if not exists collection_topics_user_status_idx
    on public.collection_topics (user_id, status, updated_at desc);

create table if not exists public.collection_topic_source_matches (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    topic_id uuid not null references public.collection_topics(id) on delete cascade,
    source_id uuid not null references public.collection_posts(id) on delete cascade,
    match_type text not null check (match_type in ('supports', 'extends', 'contradicts', 'related')),
    score numeric(5,2) not null check (score between 0 and 100),
    rationale text not null,
    matched_terms text[] not null default '{}'::text[],
    matched_by text not null check (matched_by in ('rule', 'agent')),
    status text not null default 'suggested' check (status in ('suggested', 'accepted', 'rejected')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint collection_topic_source_matches_unique unique (topic_id, source_id)
);

comment on table public.collection_topic_source_matches is
    'Traceable source-to-topic matches. A suggestion is not accepted automatically.';

create index if not exists collection_topic_source_matches_topic_status_idx
    on public.collection_topic_source_matches (topic_id, status, score desc);
create index if not exists collection_topic_source_matches_source_idx
    on public.collection_topic_source_matches (source_id);

create table if not exists public.collection_topic_ideas (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    topic_id uuid not null references public.collection_topics(id) on delete cascade,
    source_id uuid references public.collection_posts(id) on delete set null,
    idea_type text not null check (idea_type in ('question', 'research_hypothesis', 'content_angle', 'poc_candidate')),
    title text not null,
    body text,
    status text not null default 'open' check (status in ('open', 'accepted', 'deferred', 'discarded', 'completed')),
    provenance jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.collection_topic_ideas.provenance is
    'JSONB provenance: matcher or agent name, source evidence, prompt version, and confidence when applicable.';

create index if not exists collection_topic_ideas_topic_status_idx
    on public.collection_topic_ideas (topic_id, status, updated_at desc);

alter table public.collection_topics enable row level security;
alter table public.collection_topic_source_matches enable row level security;
alter table public.collection_topic_ideas enable row level security;

create policy collection_topics_owner on public.collection_topics
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy collection_topic_source_matches_owner on public.collection_topic_source_matches
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy collection_topic_ideas_owner on public.collection_topic_ideas
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop trigger if exists update_collection_topics_updated_at on public.collection_topics;
create trigger update_collection_topics_updated_at
    before update on public.collection_topics
    for each row execute procedure public.collection_update_updated_at_column();

drop trigger if exists update_collection_topic_source_matches_updated_at on public.collection_topic_source_matches;
create trigger update_collection_topic_source_matches_updated_at
    before update on public.collection_topic_source_matches
    for each row execute procedure public.collection_update_updated_at_column();

drop trigger if exists update_collection_topic_ideas_updated_at on public.collection_topic_ideas;
create trigger update_collection_topic_ideas_updated_at
    before update on public.collection_topic_ideas
    for each row execute procedure public.collection_update_updated_at_column();

commit;
