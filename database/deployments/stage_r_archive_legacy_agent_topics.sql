-- Stage R: permit archival of legacy agent-created Topics without reopening
-- automatic Topic creation.
--
-- Stage O intentionally blocked future agent_auto Topic creation. Its original
-- status check accidentally also made the existing legacy rows impossible to
-- archive. This migration only permits active or archived legacy rows; the
-- Stage O trigger still rejects every new or re-labelled agent_auto write.

begin;

alter table public.collection_topics
    drop constraint if exists collection_topics_agent_origin_status;

alter table public.collection_topics
    add constraint collection_topics_agent_origin_status
    check (
        (origin = 'agent_proposal' and status = 'proposed')
        or (origin = 'agent_auto' and status in ('active', 'archived'))
        or (origin = 'user' and status in ('active', 'paused', 'archived'))
    );

commit;
