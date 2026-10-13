-- Owner-guided integrity repair (M3, prepared but not yet applied).
--
-- Exact, idempotent repair identified by the 2026-10-13 read-only audit.
-- This migration only creates the missing review packet for persisted source
-- evidence. It does not create candidates, change a decision, infer knowledge,
-- delete data, or reference any stock schema or table.

begin;

do $$
declare
    v_user_id uuid;
    v_source_revision_id uuid;
    v_missing_packet_count integer;
begin
    -- One complete source revision was persisted without its required review
    -- packet. Refuse to run if the audit shape has changed rather than
    -- repairing an unknown new row. The canonical helper creates no proposals.
    select count(*) into v_missing_packet_count
    from public.collection_source_revisions source_revision
    left join public.owner_review_packets packet
        on packet.user_id = source_revision.user_id
       and packet.source_revision_id = source_revision.id
    where source_revision.capture_quality = 'complete'
      and packet.id is null;
    if v_missing_packet_count <> 1 then
        raise exception 'OWNER_GUIDED_REPAIR_EXPECTED_ONE_COMPLETE_SOURCE_WITHOUT_PACKET_FOUND_%', v_missing_packet_count;
    end if;
    select source_revision.user_id, source_revision.id
    into v_user_id, v_source_revision_id
    from public.collection_source_revisions source_revision
    left join public.owner_review_packets packet
        on packet.user_id = source_revision.user_id
       and packet.source_revision_id = source_revision.id
    where source_revision.capture_quality = 'complete'
      and packet.id is null;
    perform public.ensure_owner_review_packet(
        v_user_id,
        v_source_revision_id
    );
end;
$$;

commit;
