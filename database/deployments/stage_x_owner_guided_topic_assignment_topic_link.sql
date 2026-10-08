-- Complete the owner-guided Topic handoff without removing the M3
-- compatibility record.  A confirmed assignment is a source association; it
-- is deliberately not a knowledge revision and cannot create a summary.
begin;

create or replace function public.promote_owner_review_proposal(
    p_user_id uuid, p_packet_id uuid, p_proposal_id uuid, p_action text,
    p_expected_version bigint, p_edited_payload jsonb default null
)
returns public.owner_review_packets
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
    v_packet public.owner_review_packets; v_proposal public.owner_review_proposals;
    v_payload jsonb; v_folder_id uuid; v_note_status text; v_note_content text;
    v_primary text; v_related text[] := '{}'::text[]; v_remaining integer;
    v_topic_label text; v_topic_id uuid;
begin
    if p_action not in ('accept', 'edit_and_accept') then raise exception 'p_action must be accept or edit_and_accept' using errcode = '22023'; end if;
    if p_expected_version is null or p_expected_version < 1 then raise exception 'p_expected_version must be positive' using errcode = '22023'; end if;
    if p_action = 'edit_and_accept' and (p_edited_payload is null or jsonb_typeof(p_edited_payload) <> 'object') then raise exception 'p_edited_payload must be an object for edit_and_accept' using errcode = '22023'; end if;
    select * into v_packet from public.owner_review_packets where id = p_packet_id and user_id = p_user_id for update;
    if v_packet.id is null or v_packet.status <> 'open' or v_packet.version <> p_expected_version then raise exception 'REVIEW_VERSION_CONFLICT' using errcode = 'P0001'; end if;
    select * into v_proposal from public.owner_review_proposals where id = p_proposal_id and packet_id = p_packet_id and user_id = p_user_id for update;
    if v_proposal.id is null or v_proposal.status not in ('pending', 'proposed') then raise exception 'REVIEW_PROPOSAL_NOT_REVIEWABLE' using errcode = 'P0001'; end if;
    if v_proposal.proposal_type not in ('folder_assignment', 'post_learning_note', 'topic_assignment') then raise exception 'REVIEW_PROMOTION_TYPE_UNSUPPORTED' using errcode = 'P0001'; end if;
    v_payload := case when p_action = 'edit_and_accept' then p_edited_payload else v_proposal.payload end;

    if v_proposal.proposal_type = 'folder_assignment' then
        if nullif(v_payload ->> 'folder_id', '') is not null then
            v_folder_id := (v_payload ->> 'folder_id')::uuid;
            perform 1 from public.collection_collections where id = v_folder_id and user_id = p_user_id;
            if not found then raise exception 'REVIEW_FOLDER_NOT_FOUND' using errcode = 'P0001'; end if;
        end if;
        update public.collection_posts set collection_id = v_folder_id, updated_at = now()
        where id = v_packet.post_id and user_id = p_user_id;
    elsif v_proposal.proposal_type = 'post_learning_note' then
        v_note_status := nullif(btrim(v_payload ->> 'note_status'), '');
        v_note_content := nullif(btrim(v_payload ->> 'content'), '');
        if v_note_status is null or v_note_status not in ('recorded', 'not_needed') then raise exception 'REVIEW_NOTE_NOT_DECIDED' using errcode = '22023'; end if;
        if v_note_status = 'recorded' and v_note_content is null then raise exception 'REVIEW_NOTE_CONTENT_REQUIRED' using errcode = '22023'; end if;
        insert into public.owner_post_learning_notes (user_id, post_id, source_revision_id, accepted_proposal_id, note_status, content)
        values (p_user_id, v_packet.post_id, v_packet.source_revision_id, v_proposal.id, v_note_status, v_note_content)
        on conflict (user_id, source_revision_id) do update set accepted_proposal_id = excluded.accepted_proposal_id, note_status = excluded.note_status, content = excluded.content, updated_at = now();
    else
        v_primary := nullif(left(btrim(v_payload ->> 'primary_topic'), 120), '');
        if jsonb_typeof(coalesce(v_payload -> 'related_topics', '[]'::jsonb)) <> 'array' then raise exception 'REVIEW_RELATED_TOPICS_INVALID' using errcode = '22023'; end if;
        select coalesce(array_agg(topic order by ordinality), '{}'::text[]) into v_related
        from (
            select distinct on (lower(topic)) topic, ordinality
            from (
                select nullif(left(btrim(value), 120), '') as topic, ordinality
                from jsonb_array_elements_text(coalesce(v_payload -> 'related_topics', '[]'::jsonb)) with ordinality
            ) raw_topics where topic is not null order by lower(topic), ordinality
        ) unique_topics;
        if cardinality(v_related) > 2 then raise exception 'REVIEW_RELATED_TOPICS_LIMIT' using errcode = '22023'; end if;
        if v_primary is not null and exists (select 1 from unnest(v_related) as related_topic where lower(related_topic) = lower(v_primary)) then raise exception 'REVIEW_PRIMARY_TOPIC_DUPLICATED' using errcode = '22023'; end if;
        insert into public.owner_source_topic_decisions (user_id, post_id, source_revision_id, accepted_proposal_id, primary_topic_label, related_topic_labels)
        values (p_user_id, v_packet.post_id, v_packet.source_revision_id, v_proposal.id, v_primary, v_related)
        on conflict (user_id, source_revision_id) do update set accepted_proposal_id = excluded.accepted_proposal_id, primary_topic_label = excluded.primary_topic_label, related_topic_labels = excluded.related_topic_labels, updated_at = now();
        for v_topic_label in select label from (select v_primary as label union all select unnest(v_related)) topic_labels where label is not null loop
            insert into public.owner_topics (user_id, label, normalized_label)
            values (p_user_id, v_topic_label, lower(v_topic_label))
            on conflict (user_id, normalized_label) do update set updated_at = now()
            returning id into v_topic_id;
            insert into public.owner_topic_source_links (user_id, topic_id, source_revision_id, origin_proposal_id)
            values (p_user_id, v_topic_id, v_packet.source_revision_id, v_proposal.id)
            on conflict (topic_id, source_revision_id) do nothing;
        end loop;
    end if;

    update public.owner_review_proposals set status = 'accepted', reviewed_at = now(), payload = v_payload, updated_at = now() where id = v_proposal.id;
    insert into public.owner_review_approvals (user_id, packet_id, proposal_id, decision, decided_by, edited_payload)
    values (p_user_id, p_packet_id, v_proposal.id, 'accepted', p_user_id, case when p_action = 'edit_and_accept' then v_payload else null end);
    select count(*) into v_remaining from public.owner_review_proposals where packet_id = p_packet_id and user_id = p_user_id and status in ('pending', 'proposed');
    update public.owner_review_packets set status = case when v_remaining = 0 then 'completed' else 'open' end, version = version + 1, updated_at = now() where id = p_packet_id and user_id = p_user_id returning * into v_packet;
    insert into public.owner_review_audit_events (user_id, packet_id, proposal_id, event_type, actor_id, event_data)
    values (p_user_id, p_packet_id, v_proposal.id, 'proposal.promoted', p_user_id, jsonb_build_object('schema_version', 1, 'packet_version', v_packet.version, 'proposal_type', v_proposal.proposal_type, 'action', p_action));
    return v_packet;
end;
$$;

revoke all on function public.promote_owner_review_proposal(uuid, uuid, uuid, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.promote_owner_review_proposal(uuid, uuid, uuid, text, bigint, jsonb) to service_role;

commit;
