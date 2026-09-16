-- Stage Q.2: enforce tenant ownership of a Topic match's source post.
--
-- Apply after Stage Q.1 in existing environments. This redefines only the
-- trigger function; it does not rewrite historical Topic-match rows.

begin;

create or replace function public.collection_enforce_agent_topic_match_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    -- service_role bypasses RLS, so enforce the cross-table tenant invariant
    -- inside the trigger rather than relying on application checks alone.
    if not exists (
        select 1
        from public.collection_posts source
        where source.id = new.source_id
          and source.user_id = new.user_id
    ) then
        raise exception using
            errcode = '23514',
            message = 'topic source matches require a user-owned source post';
    end if;

    if TG_OP = 'UPDATE'
        and old.decision_source = 'user'
        and old.status in ('accepted', 'rejected')
        and new.matched_by = 'agent'
        and new.decision_source <> 'user' then
        return old;
    end if;

    if new.matched_by = 'agent' and new.decision_source <> 'user' then
        if not exists (
            select 1
            from public.collection_topics topic
            where topic.id = new.topic_id
              and topic.user_id = new.user_id
              and topic.origin = 'user'
              and topic.status = 'active'
        ) then
            raise exception using
                errcode = '23514',
                message = 'agent topic matches require an active user-owned topic';
        end if;

        new.status := 'suggested';
        new.decision_source := 'agent';
    end if;

    return new;
end;
$$;

revoke all on function public.collection_enforce_agent_topic_match_review()
    from public, anon, authenticated;
grant execute on function public.collection_enforce_agent_topic_match_review()
    to service_role;

commit;
