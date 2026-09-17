-- Stage W: cross-folder, evidence-first knowledge spaces.
-- Additive only: does not alter collection_posts or collection_knowledge_maps.

create table if not exists public.knowledge_spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  purpose text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  taxonomy_version integer not null default 1 check (taxonomy_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.knowledge_map_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.knowledge_spaces(id) on delete cascade,
  slug text not null,
  node_type text not null check (node_type in ('technology', 'workflow', 'option', 'comparison', 'decision', 'question')),
  title text not null,
  problem text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, slug)
);

create table if not exists public.knowledge_node_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references public.knowledge_map_nodes(id) on delete cascade,
  source_post_id uuid not null references public.collection_posts(id) on delete restrict,
  evidence_role text not null check (evidence_role in ('supports', 'contrasts', 'workflow_step', 'limitation', 'implementation', 'decision_input')),
  excerpt text not null check (length(trim(excerpt)) > 0),
  excerpt_hash text not null check (excerpt_hash ~ '^[a-f0-9]{64}$'),
  evidence_status text not null default 'source_captured' check (evidence_status in ('source_captured', 'author_claim_unverified', 'verified')),
  note text,
  created_at timestamptz not null default now(),
  unique (node_id, source_post_id, evidence_role, excerpt_hash)
);

create index if not exists knowledge_spaces_owner_status_idx
  on public.knowledge_spaces(user_id, status, created_at desc);
create index if not exists knowledge_map_nodes_space_status_idx
  on public.knowledge_map_nodes(space_id, status, created_at asc);
create index if not exists knowledge_node_evidence_node_idx
  on public.knowledge_node_evidence(node_id, created_at asc);
create index if not exists knowledge_node_evidence_source_idx
  on public.knowledge_node_evidence(source_post_id);

create or replace function public.enforce_knowledge_map_node_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  space_owner uuid;
begin
  select user_id into space_owner
  from public.knowledge_spaces
  where id = new.space_id;

  if space_owner is null or space_owner <> new.user_id then
    raise exception 'knowledge map node owner must match its knowledge space owner';
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_map_node_owner_guard on public.knowledge_map_nodes;
create trigger knowledge_map_node_owner_guard
before insert or update of user_id, space_id on public.knowledge_map_nodes
for each row execute function public.enforce_knowledge_map_node_owner();

create or replace function public.enforce_knowledge_node_evidence_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  node_owner uuid;
  source_owner uuid;
begin
  select user_id into node_owner
  from public.knowledge_map_nodes
  where id = new.node_id;

  select user_id into source_owner
  from public.collection_posts
  where id = new.source_post_id;

  if node_owner is null or source_owner is null or node_owner <> new.user_id or source_owner <> new.user_id then
    raise exception 'knowledge evidence owner must match both node and source post owner';
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_node_evidence_owner_guard on public.knowledge_node_evidence;
create trigger knowledge_node_evidence_owner_guard
before insert or update of user_id, node_id, source_post_id on public.knowledge_node_evidence
for each row execute function public.enforce_knowledge_node_evidence_owner();

alter table public.knowledge_spaces enable row level security;
alter table public.knowledge_map_nodes enable row level security;
alter table public.knowledge_node_evidence enable row level security;

drop policy if exists knowledge_spaces_owner_select on public.knowledge_spaces;
create policy knowledge_spaces_owner_select
on public.knowledge_spaces
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists knowledge_map_nodes_owner_select on public.knowledge_map_nodes;
create policy knowledge_map_nodes_owner_select
on public.knowledge_map_nodes
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists knowledge_node_evidence_owner_select on public.knowledge_node_evidence;
create policy knowledge_node_evidence_owner_select
on public.knowledge_node_evidence
for select to authenticated
using ((select auth.uid()) = user_id);
