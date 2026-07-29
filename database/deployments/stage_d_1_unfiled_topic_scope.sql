-- Stage D.1: allow exactly one user-level scope for posts that are not in a folder.
-- This does not move, modify, or classify any existing posts.

begin;

alter table public.collection_topic_scopes
    drop constraint if exists collection_topic_scopes_user_collection_unique;

alter table public.collection_topic_scopes
    alter column collection_id drop not null;

create unique index if not exists collection_topic_scopes_user_collection_unique_idx
    on public.collection_topic_scopes (user_id, collection_id)
    where collection_id is not null;

create unique index if not exists collection_topic_scopes_one_unfiled_scope_idx
    on public.collection_topic_scopes (user_id)
    where collection_id is null;

comment on column public.collection_topic_scopes.collection_id is
    'A collection folder. NULL represents the one user-level scope for unfiled posts.';

commit;
