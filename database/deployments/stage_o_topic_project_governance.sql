-- Stage O: project-first topic governance.
--
-- Deployment source only. Review and apply deliberately; it does not touch the
-- existing 60 agent-created topics or their matches. A later, reviewed data
-- migration can classify or archive those records.

begin;

create table if not exists public.collection_projects (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    slug text not null,
    title text not null,
    repository_target text not null,
    description text,
    status text not null default 'active' check (status in ('active', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint collection_projects_user_slug_unique unique (user_id, slug),
    constraint collection_projects_user_target_unique unique (user_id, repository_target),
    constraint collection_projects_github_target_check
        check (repository_target ~ '^github:[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$')
);

comment on table public.collection_projects is
    'User-owned active project registry. Topic workspaces belong to one project.';

alter table public.collection_topics
    add column if not exists project_id uuid references public.collection_projects(id) on delete restrict,
    add column if not exists domain_key text;

alter table public.collection_topics
    drop constraint if exists collection_topics_domain_key_check;
alter table public.collection_topics
    add constraint collection_topics_domain_key_check
    check (domain_key is null or domain_key in (
        'agent_workflow', 'knowledge_rag', 'data_crawling',
        'architecture_analysis', 'browser_automation', 'mobile_app',
        'ios_swiftui', 'market_data', 'portfolio_analysis',
        'visual_content', 'product_growth', 'infrastructure_security'
    ));

create unique index if not exists collection_topics_user_project_domain_active_unique
    on public.collection_topics (user_id, project_id, domain_key)
    where project_id is not null and domain_key is not null and status = 'active';
create index if not exists collection_topics_project_status_idx
    on public.collection_topics (project_id, status, updated_at desc);

alter table public.collection_topic_source_matches
    add column if not exists decision_source text not null default 'system';
alter table public.collection_topic_source_matches
    drop constraint if exists collection_topic_source_matches_decision_source_check;
alter table public.collection_topic_source_matches
    add constraint collection_topic_source_matches_decision_source_check
    check (decision_source in ('system', 'agent', 'user'));

alter table public.collection_projects enable row level security;
drop policy if exists collection_projects_owner on public.collection_projects;
create policy collection_projects_owner on public.collection_projects
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop trigger if exists update_collection_projects_updated_at on public.collection_projects;
create trigger update_collection_projects_updated_at
    before update on public.collection_projects
    for each row execute procedure public.collection_update_updated_at_column();

-- Fail closed: no pipeline may silently create a new active topic. The
-- application stores a proposal in workflow context for a human to review.
create or replace function public.collection_reject_agent_auto_topic()
returns trigger
language plpgsql
as $$
begin
    if new.origin = 'agent_auto' then
        raise exception 'agent_auto topics are disabled; create a user-owned project topic and accept a source match explicitly';
    end if;
    return new;
end;
$$;

drop trigger if exists reject_agent_auto_collection_topics on public.collection_topics;
create trigger reject_agent_auto_collection_topics
    before insert or update of origin on public.collection_topics
    for each row execute procedure public.collection_reject_agent_auto_topic();

commit;
