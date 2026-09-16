-- Stage Q.1: atomically preserve accepted/rejected user Topic-match decisions.
--
-- Apply after stage_q_topic_match_governance_hardening.sql.  This redefines the
-- trigger function for existing deployments; it does not rewrite historical rows.

begin;

create or replace function public.collection_enforce_agent_topic_match_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    -- A concurrent user decision wins over a later agent ON CONFLICT DO UPDATE.
    -- The row lock makes OLD the authoritative current state at trigger time.
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
