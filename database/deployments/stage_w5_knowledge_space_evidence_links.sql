-- Stage W5: semantic evidence links for workflow-first knowledge spaces.
-- Additive only: preserves knowledge_space_stage_nodes as legacy candidate mappings.
-- This migration creates no evidence-link records and does not alter source posts, folders, nodes, or stages.

create table if not exists public.knowledge_space_stage_evidence_links (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.knowledge_space_path_stages(id) on delete cascade,
  node_id uuid not null references public.knowledge_map_nodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  evidence_role text not null check (evidence_role in ('evidence', 'method', 'example', 'decision', 'risk', 'open_question')),
  rationale text not null check (btrim(rationale) <> ''),
  applicability text not null default '',
  limitation text not null default '',
  position integer not null default 0 check (position >= 0),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'superseded', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, node_id, evidence_role, rationale)
);

create index if not exists knowledge_space_stage_evidence_links_owner_stage_position_idx
  on public.knowledge_space_stage_evidence_links (user_id, stage_id, position, id);
create index if not exists knowledge_space_stage_evidence_links_owner_node_idx
  on public.knowledge_space_stage_evidence_links (user_id, node_id);

create or replace function public.enforce_knowledge_space_stage_evidence_link_owner()
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
    raise exception 'knowledge-space evidence link must belong to the same owner and space';
  end if;
  return new;
end;
$$;

create trigger knowledge_space_stage_evidence_link_owner_guard
before insert or update of stage_id, node_id, user_id on public.knowledge_space_stage_evidence_links
for each row execute function public.enforce_knowledge_space_stage_evidence_link_owner();

alter table public.knowledge_space_stage_evidence_links enable row level security;

create policy knowledge_space_stage_evidence_links_owner_select
on public.knowledge_space_stage_evidence_links
for select to authenticated
using ((select auth.uid()) = user_id);

-- Trigger helper is an internal integrity guard, not an RPC endpoint.
revoke execute on function public.enforce_knowledge_space_stage_evidence_link_owner() from public, anon, authenticated;
