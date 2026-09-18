-- Stage W4: extensible, owner-scoped product-path graph for knowledge spaces.
-- Additive only: does not alter collections, collection_posts, node evidence, or source-folder assignments.

create table if not exists public.knowledge_space_path_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null,
  slug text not null,
  title text not null,
  objective text not null,
  position integer not null default 0 check (position >= 0),
  required_inputs jsonb not null default '[]'::jsonb,
  expected_outputs jsonb not null default '[]'::jsonb,
  gates jsonb not null default '[]'::jsonb,
  coverage_status text not null default 'gap' check (coverage_status in ('supported', 'partial', 'gap')),
  status text not null default 'draft' check (status in ('draft', 'active', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, slug),
  foreign key (space_id, user_id)
    references public.knowledge_spaces (id, user_id)
    on delete cascade
);

create table if not exists public.knowledge_space_stage_nodes (
  stage_id uuid not null references public.knowledge_space_path_stages(id) on delete cascade,
  node_id uuid not null references public.knowledge_map_nodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  primary key (stage_id, node_id),
  unique (stage_id, node_id)
);

create table if not exists public.knowledge_space_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null,
  from_stage_id uuid not null references public.knowledge_space_path_stages(id) on delete cascade,
  to_stage_id uuid not null references public.knowledge_space_path_stages(id) on delete cascade,
  transition_type text not null check (transition_type in ('progression', 'branch', 'feedback')),
  condition text not null default '',
  created_at timestamptz not null default now(),
  unique (from_stage_id, to_stage_id, transition_type),
  foreign key (space_id, user_id)
    references public.knowledge_spaces (id, user_id)
    on delete cascade,
  check (from_stage_id <> to_stage_id)
);

create index if not exists knowledge_space_path_stages_owner_position_idx
  on public.knowledge_space_path_stages (user_id, space_id, position, slug);
create index if not exists knowledge_space_stage_nodes_owner_stage_position_idx
  on public.knowledge_space_stage_nodes (user_id, stage_id, position, node_id);
create index if not exists knowledge_space_stage_transitions_owner_space_idx
  on public.knowledge_space_stage_transitions (user_id, space_id, from_stage_id, to_stage_id);

create or replace function public.enforce_knowledge_space_stage_node_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stage_owner uuid;
  stage_space uuid;
  node_owner uuid;
  node_space uuid;
begin
  select user_id, space_id into stage_owner, stage_space
  from public.knowledge_space_path_stages
  where id = new.stage_id;

  select user_id, space_id into node_owner, node_space
  from public.knowledge_map_nodes
  where id = new.node_id;

  if stage_owner is null or node_owner is null
     or stage_owner <> new.user_id
     or node_owner <> new.user_id
     or stage_space <> node_space then
    raise exception 'knowledge-space stage node must belong to the same owner and space';
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_space_stage_node_owner_guard on public.knowledge_space_stage_nodes;
create trigger knowledge_space_stage_node_owner_guard
before insert or update of stage_id, node_id, user_id on public.knowledge_space_stage_nodes
for each row execute function public.enforce_knowledge_space_stage_node_owner();

create or replace function public.enforce_knowledge_space_stage_transition_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  from_owner uuid;
  from_space uuid;
  to_owner uuid;
  to_space uuid;
begin
  select user_id, space_id into from_owner, from_space
  from public.knowledge_space_path_stages
  where id = new.from_stage_id;

  select user_id, space_id into to_owner, to_space
  from public.knowledge_space_path_stages
  where id = new.to_stage_id;

  if from_owner is null or to_owner is null
     or from_owner <> new.user_id
     or to_owner <> new.user_id
     or from_space <> new.space_id
     or to_space <> new.space_id then
    raise exception 'knowledge-space transition must remain within one owner and space';
  end if;
  return new;
end;
$$;

drop trigger if exists knowledge_space_stage_transition_owner_guard on public.knowledge_space_stage_transitions;
create trigger knowledge_space_stage_transition_owner_guard
before insert or update of user_id, space_id, from_stage_id, to_stage_id on public.knowledge_space_stage_transitions
for each row execute function public.enforce_knowledge_space_stage_transition_owner();

alter table public.knowledge_space_path_stages enable row level security;
alter table public.knowledge_space_stage_nodes enable row level security;
alter table public.knowledge_space_stage_transitions enable row level security;

drop policy if exists knowledge_space_path_stages_owner_select on public.knowledge_space_path_stages;
create policy knowledge_space_path_stages_owner_select
on public.knowledge_space_path_stages
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists knowledge_space_stage_nodes_owner_select on public.knowledge_space_stage_nodes;
create policy knowledge_space_stage_nodes_owner_select
on public.knowledge_space_stage_nodes
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists knowledge_space_stage_transitions_owner_select on public.knowledge_space_stage_transitions;
create policy knowledge_space_stage_transitions_owner_select
on public.knowledge_space_stage_transitions
for select to authenticated
using ((select auth.uid()) = user_id);
