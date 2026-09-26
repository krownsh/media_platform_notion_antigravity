-- Stage Y: additive canonical source-taxonomy projection. This migration records
-- auditable category proposals only; it never routes, moves, or rewrites sources.

create extension if not exists pgcrypto;

create table if not exists public.source_post_canonical_classifications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.collection_posts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  taxonomy_version integer not null check (taxonomy_version = 1),
  taxonomy_artifact_sha256 text not null check (taxonomy_artifact_sha256 ~ '^[a-f0-9]{64}$'),
  category_key text check (category_key in (
    'product-idea-validation',
    'product-strategy-growth-business',
    'ux-research-onboarding',
    'ui-design-system-visual-implementation',
    'web-application-development',
    'ios-development-app-store',
    'android-development-google-play',
    'architecture-backend-data',
    'engineering-quality-testing',
    'git-pr-engineering-collaboration',
    'devops-cicd-infrastructure',
    'security-privacy-credentials',
    'game-interactive-product-development',
    'ai-coding-developer-tools',
    'agent-systems-mcp-automation',
    'generative-visual-video-audio',
    'ai-interaction-prompt-model-use',
    'knowledge-learning-productivity',
    'investment-financial-markets',
    'career-life-interests'
  )),
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1),
  status text not null check (status in ('proposed', 'accepted', 'needs_review', 'rejected')),
  evidence_excerpt text,
  rationale text,
  classifier_kind text not null check (classifier_kind in ('rules', 'hermes_codex', 'human')),
  classifier_version text not null,
  source_content_hash text not null check (source_content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,
  unique (post_id, taxonomy_artifact_sha256),
  check (
    (status = 'needs_review' and category_key is null)
    or (category_key is not null and confidence is not null and evidence_excerpt is not null)
  )
);

create table if not exists public.source_post_canonical_classification_audit_events (
  id uuid primary key default gen_random_uuid(),
  classification_id uuid not null references public.source_post_canonical_classifications(id) on delete restrict,
  -- Deliberately no auth.users FK: immutable audit must survive identity lifecycle changes.
  user_id uuid not null,
  actor_user_id uuid,
  event_type text not null check (event_type in ('proposed', 'accepted', 'needs_review', 'rejected', 'updated')),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists source_post_canonical_classifications_owner_status_idx
  on public.source_post_canonical_classifications(user_id, status, created_at desc);
create index if not exists source_post_canonical_classification_audit_events_classification_idx
  on public.source_post_canonical_classification_audit_events(classification_id, created_at asc);

create or replace function public.enforce_source_post_canonical_classification_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_owner uuid;
begin
  select user_id into source_owner from public.collection_posts where id = new.post_id;
  if source_owner is null or source_owner <> new.user_id then
    raise exception 'canonical classification owner must match source post owner';
  end if;
  return new;
end;
$$;

drop trigger if exists source_post_canonical_classifications_owner_guard on public.source_post_canonical_classifications;
create trigger source_post_canonical_classifications_owner_guard
before insert or update of post_id, user_id on public.source_post_canonical_classifications
for each row execute function public.enforce_source_post_canonical_classification_owner();

create or replace function public.append_source_post_canonical_classification_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_event_type text;
  before_snapshot jsonb;
  actor uuid;
begin
  actor := auth.uid();
  if tg_op = 'INSERT' then
    audit_event_type := 'proposed';
    before_snapshot := null;
  elsif new.status is distinct from old.status then
    audit_event_type := new.status;
    before_snapshot := to_jsonb(old);
  else
    audit_event_type := 'updated';
    before_snapshot := to_jsonb(old);
  end if;

  insert into public.source_post_canonical_classification_audit_events (
    classification_id, user_id, actor_user_id, event_type, event_data
  ) values (
    new.id,
    new.user_id,
    actor,
    audit_event_type,
    jsonb_build_object(
      'before', before_snapshot,
      'after', to_jsonb(new),
      'actor_authenticated_user_id', actor
    )
  );
  return new;
end;
$$;

drop trigger if exists source_post_canonical_classifications_audit_append on public.source_post_canonical_classifications;
create trigger source_post_canonical_classifications_audit_append
after insert or update on public.source_post_canonical_classifications
for each row execute function public.append_source_post_canonical_classification_audit();

create or replace function public.prevent_source_post_canonical_classification_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'canonical classification audit events are immutable';
end;
$$;

drop trigger if exists source_post_canonical_classification_audit_immutable_guard on public.source_post_canonical_classification_audit_events;
create trigger source_post_canonical_classification_audit_immutable_guard
before update or delete on public.source_post_canonical_classification_audit_events
for each row execute function public.prevent_source_post_canonical_classification_audit_mutation();

alter table public.source_post_canonical_classifications enable row level security;
alter table public.source_post_canonical_classification_audit_events enable row level security;

drop policy if exists source_post_canonical_classifications_owner_select on public.source_post_canonical_classifications;
create policy source_post_canonical_classifications_owner_select
on public.source_post_canonical_classifications
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists source_post_canonical_classifications_owner_insert on public.source_post_canonical_classifications;
create policy source_post_canonical_classifications_owner_insert
on public.source_post_canonical_classifications
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists source_post_canonical_classifications_owner_update on public.source_post_canonical_classifications;
create policy source_post_canonical_classifications_owner_update
on public.source_post_canonical_classifications
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists source_post_canonical_classification_audit_events_owner_select on public.source_post_canonical_classification_audit_events;
create policy source_post_canonical_classification_audit_events_owner_select
on public.source_post_canonical_classification_audit_events
for select to authenticated
using ((select auth.uid()) = user_id);
