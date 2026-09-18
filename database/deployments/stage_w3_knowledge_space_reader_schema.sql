-- Stage W3: reconcile the live knowledge-space schema with the read-only reader contract.
-- Additive: does not touch collections, collection_posts, source excerpts, or folder assignments.

alter table public.knowledge_spaces
  add column if not exists taxonomy_version integer not null default 1;

alter table public.knowledge_spaces
  drop constraint if exists knowledge_spaces_taxonomy_version_check;

alter table public.knowledge_spaces
  add constraint knowledge_spaces_taxonomy_version_check
  check (taxonomy_version >= 1);

alter table public.knowledge_map_nodes
  add column if not exists slug text;

-- Existing rows are preserved and get an immutable deterministic fallback slug.
update public.knowledge_map_nodes
set slug = 'legacy-' || id::text
where slug is null or btrim(slug) = '';

alter table public.knowledge_map_nodes
  alter column slug set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.knowledge_map_nodes'::regclass
      and conname = 'knowledge_map_nodes_space_slug_unique'
  ) then
    alter table public.knowledge_map_nodes
      add constraint knowledge_map_nodes_space_slug_unique unique (space_id, slug);
  end if;
end $$;
