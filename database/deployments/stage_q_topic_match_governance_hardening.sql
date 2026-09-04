-- Stage Q: fail-closed governance for agent-created Topic source matches.
--
-- Deployment source only. Apply after stage_o_topic_project_governance.sql.
-- This migration does not rewrite existing matches. It protects future writes
-- even when a caller bypasses the Node preprocess wrapper.

begin;

do $$
begin
    if to_regclass('public.collection_topics') is null
        or to_regclass('public.collection_topic_source_matches') is null then
        raise exception 'Stage Q requires the Stage C Topic tables';
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'collection_topic_source_matches'
          and column_name = 'decision_source'
    ) then
        raise exception 'Stage Q requires stage_o_topic_project_governance.sql';
    end if;
end;
$$;

create or replace function public.collection_enforce_agent_topic_match_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    -- A user decision is authoritative and may accept or reject a prior agent
    -- suggestion. Every other write labelled as agent-generated stays pending.
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

drop trigger if exists enforce_agent_topic_match_review
    on public.collection_topic_source_matches;
create trigger enforce_agent_topic_match_review
    before insert or update on public.collection_topic_source_matches
    for each row execute function public.collection_enforce_agent_topic_match_review();

commit;
