-- Stage P: harden direct browser access to posts and Collections.
--
-- Deployment source only. Apply after the Stage O preflight has confirmed
-- there are no cross-tenant collection links. This changes no post content or
-- Collection data; it only adds ownership integrity, grants, and RLS policies.

begin;

-- Refuse a deployment that would validate legacy cross-tenant links instead of
-- making their repair an explicit, reviewable operation.
do $$
begin
    if exists (
        select 1
        from public.collection_posts post
        left join public.collection_collections collection
            on collection.id = post.collection_id
           and collection.user_id = post.user_id
        where post.collection_id is not null
          and collection.id is null
    ) then
        raise exception 'Stage P blocked: collection_posts contains cross-tenant or missing collection links';
    end if;
end;
$$;

-- Enforce the same-owner relationship even for service-role writes. `id` is
-- already the primary key; this pair is the referenced tenant-aware key.
alter table public.collection_collections
    add constraint collection_collections_id_user_unique unique (id, user_id);

alter table public.collection_posts
    add constraint collection_posts_collection_owner_fkey
    foreign key (collection_id, user_id)
    references public.collection_collections (id, user_id)
    on delete set null (collection_id);

create index if not exists collection_posts_user_collection_idx
    on public.collection_posts (user_id, collection_id)
    where collection_id is not null;

create index if not exists collection_collections_user_created_idx
    on public.collection_collections (user_id, created_at desc);

-- Remove the permissive default grants first. RLS alone is not a substitute
-- for grants, and `public` includes unauthenticated callers.
revoke all on table public.collection_posts, public.collection_collections
    from public, anon, authenticated;
grant select, insert, update, delete on table public.collection_posts, public.collection_collections
    to authenticated, service_role;

drop policy if exists "Users can view their own posts" on public.collection_posts;
drop policy if exists "Users can insert their own posts" on public.collection_posts;
drop policy if exists "Users can update their own posts" on public.collection_posts;
drop policy if exists "Users can delete their own posts" on public.collection_posts;

create policy "Users can view their own posts"
    on public.collection_posts for select to authenticated
    using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert their own posts"
    on public.collection_posts for insert to authenticated
    with check (
        (select auth.uid()) is not null
        and (select auth.uid()) = user_id
        and (
            collection_id is null
            or exists (
                select 1
                from public.collection_collections collection
                where collection.id = collection_posts.collection_id
                  and collection.user_id = (select auth.uid())
            )
        )
    );

create policy "Users can update their own posts"
    on public.collection_posts for update to authenticated
    using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
    with check (
        (select auth.uid()) is not null
        and (select auth.uid()) = user_id
        and (
            collection_id is null
            or exists (
                select 1
                from public.collection_collections collection
                where collection.id = collection_posts.collection_id
                  and collection.user_id = (select auth.uid())
            )
        )
    );

create policy "Users can delete their own posts"
    on public.collection_posts for delete to authenticated
    using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can view their own collections" on public.collection_collections;
drop policy if exists "Users can insert their own collections" on public.collection_collections;
drop policy if exists "Users can update their own collections" on public.collection_collections;
drop policy if exists "Users can delete their own collections" on public.collection_collections;

create policy "Users can view their own collections"
    on public.collection_collections for select to authenticated
    using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert their own collections"
    on public.collection_collections for insert to authenticated
    with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own collections"
    on public.collection_collections for update to authenticated
    using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
    with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete their own collections"
    on public.collection_collections for delete to authenticated
    using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

alter table public.collection_posts enable row level security;
alter table public.collection_collections enable row level security;

commit;
