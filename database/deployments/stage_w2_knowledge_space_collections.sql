-- Stage W2: explicit, owner-scoped source-folder scope for cross-folder knowledge spaces.
-- Additive only: no collection or post rows are created, moved, or updated.

alter table public.knowledge_spaces
  add constraint knowledge_spaces_id_user_unique unique (id, user_id);

create table public.knowledge_space_collections (
  space_id uuid not null,
  collection_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_role text not null default 'supporting' check (scope_role in ('primary', 'supporting')),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (space_id, collection_id),
  foreign key (space_id, user_id)
    references public.knowledge_spaces (id, user_id)
    on delete cascade,
  foreign key (collection_id, user_id)
    references public.collection_collections (id, user_id)
    on delete restrict
);

create index knowledge_space_collections_owner_position_idx
  on public.knowledge_space_collections (user_id, space_id, position, collection_id);

alter table public.knowledge_space_collections enable row level security;

create policy knowledge_space_collections_owner_select
on public.knowledge_space_collections
for select to authenticated
using ((select auth.uid()) = user_id);

comment on table public.knowledge_space_collections is
  'Explicit owner-scoped source-folder scope for a cross-folder knowledge space; does not move posts.';
