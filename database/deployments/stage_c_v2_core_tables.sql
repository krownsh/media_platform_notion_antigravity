-- Stage C V2 Core Tables Schema Definition
--
-- This script creates the core schema for the Knowledge-Action Vault V2 architecture:
-- 1. source_routes: Multi-intent routing classifications per captured bookmark.
-- 2. projects, project_snapshots, project_needs: Project intelligence & audit ledger.
-- 3. application_cases, experiments, experiment_runs, integration_proposals: Application & POC engine.
-- 4. agent_jobs, agent_job_events: Control plane for Local Agent Runner tasks.
-- 5. content_assets, content_revisions, content_evidence_links: Content Studio output & attribution tracking.

begin;

-- Enable UUID extension if missing
create extension if not exists "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. Source Routing
--------------------------------------------------------------------------------
create table if not exists public.source_routes (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_id uuid not null references public.collection_posts(id) on delete cascade,
    routes jsonb not null default '[]'::jsonb, -- Array of { type, priority, reason }
    primary_intent text not null check (primary_intent in ('quick_rewrite', 'translate_localize', 'research_content', 'apply_poc')),
    urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high', 'critical')),
    reasons text[] not null default '{}'::text[],
    status text not null default 'active' check (status in ('active', 'processed', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists source_routes_user_source_idx on public.source_routes (user_id, source_id);
create index if not exists source_routes_primary_intent_idx on public.source_routes (primary_intent);
alter table public.source_routes enable row level security;

--------------------------------------------------------------------------------
-- 2. Project Intelligence & Audit Ledger
--------------------------------------------------------------------------------
create table if not exists public.projects (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    slug text not null,
    description text,
    repo_url text,
    local_path_windows text,
    local_path_mac text,
    tech_stack text[] not null default '{}'::text[],
    status text not null default 'active' check (status in ('active', 'paused', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint projects_user_slug_unique unique (user_id, slug)
);

alter table public.projects enable row level security;

create table if not exists public.project_snapshots (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    commit_hash text,
    file_count integer not null default 0,
    capabilities jsonb not null default '[]'::jsonb,
    summary text,
    audit_metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.project_snapshots enable row level security;

create table if not exists public.project_needs (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    category text not null check (category in ('bug', 'missing_feature', 'silent_failure', 'tech_debt', 'missing_test', 'security_risk')),
    impact text not null,
    severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
    confidence numeric(3,2) not null default 0.80 check (confidence between 0 and 1),
    evidence jsonb not null default '[]'::jsonb, -- Array of { type, location, detail }
    suggested_validation text,
    status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'deferred', 'dismissed')),
    last_checked_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists project_needs_project_status_idx on public.project_needs (project_id, status);
alter table public.project_needs enable row level security;

--------------------------------------------------------------------------------
-- 3. Application & POC Engine
--------------------------------------------------------------------------------
create table if not exists public.application_cases (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_id uuid not null references public.collection_posts(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    project_need_id uuid references public.project_needs(id) on delete set null,
    title text not null,
    hypothesis text not null,
    expected_value text,
    candidate_module text,
    risk_assessment jsonb not null default '{}'::jsonb, -- { license, security_risk, dependency_cost }
    status text not null default 'planned' check (status in ('planned', 'testing', 'evaluated', 'integrated', 'deferred', 'rejected')),
    evaluation_result text check (evaluation_result in ('adopt', 'pilot', 'defer', 'reject', 'blocked')),
    rejection_reason text,
    retry_trigger text,
    retry_after timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.application_cases enable row level security;

--------------------------------------------------------------------------------
-- 4. Agent Job Control Plane
--------------------------------------------------------------------------------
create table if not exists public.agent_jobs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    job_type text not null check (job_type in (
        'project_audit_full', 'project_audit_incremental', 'opportunity_match',
        'research_candidate', 'poc_execute', 'integration_prepare', 'content_transform'
    )),
    project_id uuid references public.projects(id) on delete set null,
    source_id uuid references public.collection_posts(id) on delete set null,
    application_case_id uuid references public.application_cases(id) on delete set null,
    status text not null default 'queued' check (status in (
        'queued', 'leased', 'running', 'awaiting_approval', 'completed', 'failed', 'blocked', 'expired', 'cancelled'
    )),
    priority integer not null default 50 check (priority between 1 and 100),
    intent_capsule jsonb not null default '{}'::jsonb,
    allowed_paths text[] not null default '{}'::text[],
    allowed_commands text[] not null default '{}'::text[],
    lease_owner text,
    lease_expires_at timestamptz,
    attempts integer not null default 0,
    max_attempts integer not null default 3,
    correlation_id text,
    result_artifacts jsonb not null default '[]'::jsonb,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists agent_jobs_queued_idx on public.agent_jobs (priority desc, created_at asc) where status = 'queued';
alter table public.agent_jobs enable row level security;

create table if not exists public.agent_job_events (
    id uuid primary key default uuid_generate_v4(),
    agent_job_id uuid not null references public.agent_jobs(id) on delete cascade,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.agent_job_events enable row level security;

--------------------------------------------------------------------------------
-- 5. Content Studio & Output Engine
--------------------------------------------------------------------------------
create table if not exists public.content_assets (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_id uuid references public.collection_posts(id) on delete set null,
    application_case_id uuid references public.application_cases(id) on delete set null,
    title text not null,
    format text not null check (format in ('x_thread', 'linkedin_post', 'blog_article', 'short_script', 'newsletter')),
    status text not null default 'draft' check (status in ('draft', 'review_pending', 'approved', 'published', 'archived')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.content_assets enable row level security;

create table if not exists public.content_revisions (
    id uuid primary key default uuid_generate_v4(),
    content_asset_id uuid not null references public.content_assets(id) on delete cascade,
    revision_number integer not null check (revision_number > 0),
    body text not null,
    change_summary text,
    author_type text not null check (author_type in ('ai', 'user')),
    created_at timestamptz not null default now(),
    constraint content_revisions_asset_num_unique unique (content_asset_id, revision_number)
);

alter table public.content_revisions enable row level security;

create table if not exists public.content_evidence_links (
    id uuid primary key default uuid_generate_v4(),
    content_asset_id uuid not null references public.content_assets(id) on delete cascade,
    evidence_type text not null check (evidence_type in ('source_post', 'project_need', 'poc_result', 'code_diff')),
    target_id uuid not null,
    citation_text text,
    created_at timestamptz not null default now()
);

alter table public.content_evidence_links enable row level security;

--------------------------------------------------------------------------------
-- RLS Policies (Owner-only access for all tenant tables)
--------------------------------------------------------------------------------
do $$
declare
    tbl text;
begin
    for tbl in select unnest(array[
        'source_routes', 'projects', 'project_snapshots', 'project_needs',
        'application_cases', 'agent_jobs', 'content_assets'
    ]) loop
        execute format('drop policy if exists tenant_isolation_policy on public.%I', tbl);
        execute format('create policy tenant_isolation_policy on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', tbl);
    end loop;
end $$;

commit;
