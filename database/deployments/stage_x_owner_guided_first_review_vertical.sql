-- Owner-guided first review vertical (M3).
-- Depends on the M2 review domain. Promotion is deliberately limited to the
-- three explicit types below; all other formal domains remain for later M4+.

begin;

create table if not exists public.owner_post_learning_notes (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    post_id uuid not null references public.collection_posts(id) on delete cascade,
    source_revision_id uuid not null references public.collection_source_revisions(id) on delete restrict,
    accepted_proposal_id uuid not null references public.owner_review_proposals(id) on delete restrict,
    note_status text not null check (note_status in ('recorded', 'not_needed')),
    content text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, source_revision_id),
    unique (accepted_proposal_id)
);
comment on table public.owner_post_learning_notes is
    'Owner-accepted per-source learning state. `not_needed` is an explicit useful decision. A candidate marked `needs_discussion` is intentionally not promotable until the Owner records a note or rejects/defers it.';

create table if not exists public.owner_source_topic_decisions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    post_id uuid not null references public.collection_posts(id) on delete cascade,
    source_revision_id uuid not null references public.collection_source_revisions(id) on delete restrict,
    accepted_proposal_id uuid not null references public.owner_review_proposals(id) on delete restrict,
    primary_topic_label text,
    related_topic_labels text[] not null default '{}'::text[] check (cardinality(related_topic_labels) <= 2),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, source_revision_id),
    unique (accepted_proposal_id)
);
comment on table public.owner_source_topic_decisions is
    'Owner-accepted Topic labels for a source revision. M4 resolves labels into independent Topic knowledge records and cited revisions; this table never uses legacy repository-bound topics.';

alter table public.owner_post_learning_notes enable row level security;
alter table public.owner_source_topic_decisions enable row level security;
drop policy if exists "Owners view their post learning notes" on public.owner_post_learning_notes;
create policy "Owners view their post learning notes" on public.owner_post_learning_notes for select to authenticated
    using ((select auth.uid()) = user_id);
drop policy if exists "Owners view their source Topic decisions" on public.owner_source_topic_decisions;
create policy "Owners view their source Topic decisions" on public.owner_source_topic_decisions for select to authenticated
    using ((select auth.uid()) = user_id);

-- The browser can read only its own accepted results. Formal writes remain
-- exclusively inside the service-role promotion transaction.
revoke all on table public.owner_post_learning_notes from anon, authenticated;
revoke all on table public.owner_source_topic_decisions from anon, authenticated;
grant select on table public.owner_post_learning_notes, public.owner_source_topic_decisions to authenticated;
grant select, insert, update, delete on table public.owner_post_learning_notes,
    public.owner_source_topic_decisions to service_role;

drop trigger if exists update_owner_post_learning_notes_updated_at on public.owner_post_learning_notes;
create trigger update_owner_post_learning_notes_updated_at before update on public.owner_post_learning_notes
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_source_topic_decisions_updated_at on public.owner_source_topic_decisions;
create trigger update_owner_source_topic_decisions_updated_at before update on public.owner_source_topic_decisions
    for each row execute procedure public.collection_update_updated_at_column();

comment on table public.owner_review_proposals is
    'Candidate decision. Generic acceptance records approval evidence only. M3 promotion may atomically write formal state solely for folder_assignment, post_learning_note, and topic_assignment after explicit Owner acceptance.';

-- Generic M2 decision can reject any candidate, but accepting these types must
-- use the promotion function below so no accepted decision loses its formal
-- write in a separate, non-atomic request.
create or replace function public.transition_owner_review_proposal(
    p_user_id uuid, p_packet_id uuid, p_proposal_id uuid, p_action text,
    p_expected_version bigint, p_edited_payload jsonb default null
)
returns public.owner_review_packets
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_packet public.owner_review_packets; v_proposal public.owner_review_proposals;
    v_decision text; v_remaining integer;
begin
    if p_action not in ('accept', 'reject', 'edit_and_accept') then raise exception 'p_action is invalid' using errcode = '22023'; end if;
    if p_expected_version is null or p_expected_version < 1 then raise exception 'p_expected_version must be positive' using errcode = '22023'; end if;
    if p_action = 'edit_and_accept' and (p_edited_payload is null or jsonb_typeof(p_edited_payload) <> 'object') then raise exception 'p_edited_payload must be an object for edit_and_accept' using errcode = '22023'; end if;
    select * into v_packet from public.owner_review_packets where id = p_packet_id and user_id = p_user_id for update;
    if v_packet.id is null or v_packet.status <> 'open' or v_packet.version <> p_expected_version then raise exception 'REVIEW_VERSION_CONFLICT' using errcode = 'P0001'; end if;
    select * into v_proposal from public.owner_review_proposals where id = p_proposal_id and packet_id = p_packet_id and user_id = p_user_id for update;
    if v_proposal.id is null or v_proposal.status not in ('pending', 'proposed') then raise exception 'REVIEW_PROPOSAL_NOT_REVIEWABLE' using errcode = 'P0001'; end if;
    if p_action in ('accept', 'edit_and_accept') and v_proposal.proposal_type in ('folder_assignment', 'post_learning_note', 'topic_assignment') then
        raise exception 'REVIEW_PROMOTION_REQUIRED' using errcode = 'P0001';
    end if;
    v_decision := case when p_action = 'reject' then 'rejected' else 'accepted' end;
    update public.owner_review_proposals set status = v_decision, reviewed_at = now(), payload = case when p_action = 'edit_and_accept' then p_edited_payload else payload end, updated_at = now() where id = v_proposal.id;
    insert into public.owner_review_approvals (user_id, packet_id, proposal_id, decision, decided_by, edited_payload)
    values (p_user_id, p_packet_id, p_proposal_id, v_decision, p_user_id, case when p_action = 'edit_and_accept' then p_edited_payload else null end);
    select count(*) into v_remaining from public.owner_review_proposals where packet_id = p_packet_id and user_id = p_user_id and status in ('pending', 'proposed');
    update public.owner_review_packets set status = case when v_remaining = 0 then 'completed' else 'open' end, version = version + 1, updated_at = now()
    where id = p_packet_id and user_id = p_user_id returning * into v_packet;
    insert into public.owner_review_audit_events (user_id, packet_id, proposal_id, event_type, actor_id, event_data)
    values (p_user_id, p_packet_id, p_proposal_id, 'proposal.' || v_decision, p_user_id, jsonb_build_object('schema_version', 1, 'packet_version', v_packet.version, 'action', p_action));
    return v_packet;
end;
$$;

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
            ) raw_topics
            where topic is not null
            order by lower(topic), ordinality
        ) unique_topics;
        if cardinality(v_related) > 2 then raise exception 'REVIEW_RELATED_TOPICS_LIMIT' using errcode = '22023'; end if;
        if v_primary is not null and exists (select 1 from unnest(v_related) as related_topic where lower(related_topic) = lower(v_primary)) then
            raise exception 'REVIEW_PRIMARY_TOPIC_DUPLICATED' using errcode = '22023';
        end if;
        insert into public.owner_source_topic_decisions (user_id, post_id, source_revision_id, accepted_proposal_id, primary_topic_label, related_topic_labels)
        values (p_user_id, v_packet.post_id, v_packet.source_revision_id, v_proposal.id, v_primary, v_related)
        on conflict (user_id, source_revision_id) do update set accepted_proposal_id = excluded.accepted_proposal_id, primary_topic_label = excluded.primary_topic_label, related_topic_labels = excluded.related_topic_labels, updated_at = now();
    end if;

    update public.owner_review_proposals set status = 'accepted', reviewed_at = now(), payload = v_payload, updated_at = now() where id = v_proposal.id;
    insert into public.owner_review_approvals (user_id, packet_id, proposal_id, decision, decided_by, edited_payload)
    values (p_user_id, p_packet_id, p_proposal_id, 'accepted', p_user_id, case when p_action = 'edit_and_accept' then v_payload else null end);
    select count(*) into v_remaining from public.owner_review_proposals where packet_id = p_packet_id and user_id = p_user_id and status in ('pending', 'proposed');
    update public.owner_review_packets set status = case when v_remaining = 0 then 'completed' else 'open' end, version = version + 1, updated_at = now()
    where id = p_packet_id and user_id = p_user_id returning * into v_packet;
    insert into public.owner_review_audit_events (user_id, packet_id, proposal_id, event_type, actor_id, event_data)
    values (p_user_id, p_packet_id, p_proposal_id, 'proposal.promoted', p_user_id, jsonb_build_object('schema_version', 1, 'packet_version', v_packet.version, 'proposal_type', v_proposal.proposal_type, 'action', p_action));
    return v_packet;
end;
$$;

revoke all on function public.promote_owner_review_proposal(uuid, uuid, uuid, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.promote_owner_review_proposal(uuid, uuid, uuid, text, bigint, jsonb) to service_role;

commit;
