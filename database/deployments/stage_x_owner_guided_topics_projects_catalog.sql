-- Owner-guided Topics and Project Catalog (M4).
-- This is intentionally separate from legacy collection_topics and
-- collection_projects. Apply after the M3 owner-guided review migrations.

begin;

create table if not exists public.owner_topics (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    label text not null check (char_length(btrim(label)) between 1 and 120),
    normalized_label text not null check (char_length(btrim(normalized_label)) between 1 and 120),
    status text not null default 'active' check (status in ('active', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, normalized_label)
);
comment on table public.owner_topics is
    'Owner-guided Topic identity, independent of a repository, folder, or legacy collection_topics record. normalized_label is a trimmed lowercase comparison key.';

create table if not exists public.owner_topic_source_links (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    topic_id uuid not null references public.owner_topics(id) on delete cascade,
    source_revision_id uuid not null references public.collection_source_revisions(id) on delete restrict,
    origin_proposal_id uuid not null references public.owner_review_proposals(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (topic_id, source_revision_id)
);
comment on table public.owner_topic_source_links is
    'Accepted Topic-to-source association. This is a citation link, not a claim or an automatically generated knowledge summary.';

create table if not exists public.owner_topic_revisions (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    topic_id uuid not null references public.owner_topics(id) on delete cascade,
    source_revision_id uuid not null references public.collection_source_revisions(id) on delete restrict,
    origin_proposal_id uuid not null references public.owner_review_proposals(id) on delete restrict,
    revision_number integer not null check (revision_number > 0),
    summary text not null check (char_length(btrim(summary)) between 1 and 12000),
    claims jsonb not null default '[]'::jsonb check (jsonb_typeof(claims) = 'array'),
    open_questions jsonb not null default '[]'::jsonb check (jsonb_typeof(open_questions) = 'array'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (topic_id, revision_number)
);
comment on table public.owner_topic_revisions is
    'Owner-accepted, cited Topic knowledge delta. claims and open_questions are JSON arrays of concise strings; full source content remains only in the source revision.';

create table if not exists public.owner_topic_revision_citations (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    topic_revision_id uuid not null references public.owner_topic_revisions(id) on delete cascade,
    source_revision_id uuid not null references public.collection_source_revisions(id) on delete restrict,
    stance text not null default 'supporting' check (stance in ('supporting', 'contrasting', 'context')),
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (topic_revision_id, source_revision_id)
);
comment on table public.owner_topic_revision_citations is
    'Citations for one owner-approved Topic revision. stance describes evidence relation and never changes the captured source.';

create table if not exists public.owner_project_catalog (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(btrim(title)) between 1 and 160),
    slug text not null check (slug ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
    project_kind text not null check (project_kind in ('local_repository', 'remote_repository', 'non_code')),
    reference text not null check (char_length(btrim(reference)) between 1 and 2048),
    description text,
    status text not null default 'active' check (status in ('active', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, slug),
    unique (user_id, project_kind, reference)
);
comment on table public.owner_project_catalog is
    'Explicit Owner Project Catalog. reference may be a local path, remote URL/identifier, or non-code initiative identifier; no entry grants filesystem or repository mutation authority.';

create table if not exists public.owner_topic_project_references (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    topic_id uuid not null references public.owner_topics(id) on delete cascade,
    project_id uuid not null references public.owner_project_catalog(id) on delete cascade,
    source_revision_id uuid not null references public.collection_source_revisions(id) on delete restrict,
    origin_proposal_id uuid not null references public.owner_review_proposals(id) on delete restrict,
    rationale text not null check (char_length(btrim(rationale)) between 1 and 4000),
    status text not null default 'active' check (status in ('active', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (topic_id, project_id, source_revision_id)
);
comment on table public.owner_topic_project_references is
    'Owner-accepted candidate application of a Topic to a catalogued project. It records relevance only; it does not change the project or execute work.';

create table if not exists public.owner_poc_proposals (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    project_reference_id uuid not null references public.owner_topic_project_references(id) on delete cascade,
    objective text not null check (char_length(btrim(objective)) between 1 and 4000),
    isolation_spec jsonb not null default '{}'::jsonb check (jsonb_typeof(isolation_spec) = 'object'),
    status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
    version bigint not null default 1 check (version >= 1),
    approved_at timestamptz,
    rejected_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
comment on table public.owner_poc_proposals is
    'Separate Owner POC proposal and approval gate. An approved row authorizes only an isolated future workspace specification; it never executes a command or modifies a real project.';

create index if not exists owner_topics_user_updated_idx on public.owner_topics (user_id, updated_at desc);
create index if not exists owner_topic_source_links_topic_idx on public.owner_topic_source_links (topic_id, created_at desc);
create index if not exists owner_topic_revisions_topic_revision_idx on public.owner_topic_revisions (topic_id, revision_number desc);
create index if not exists owner_topic_project_references_project_idx on public.owner_topic_project_references (project_id, status, updated_at desc);
create index if not exists owner_poc_proposals_reference_idx on public.owner_poc_proposals (project_reference_id, status, updated_at desc);

alter table public.owner_topics enable row level security;
alter table public.owner_topic_source_links enable row level security;
alter table public.owner_topic_revisions enable row level security;
alter table public.owner_topic_revision_citations enable row level security;
alter table public.owner_project_catalog enable row level security;
alter table public.owner_topic_project_references enable row level security;
alter table public.owner_poc_proposals enable row level security;

drop policy if exists "Owners view their guided Topics" on public.owner_topics;
drop policy if exists "Owners view their guided Topic source links" on public.owner_topic_source_links;
drop policy if exists "Owners view their guided Topic revisions" on public.owner_topic_revisions;
drop policy if exists "Owners view their guided Topic citations" on public.owner_topic_revision_citations;
drop policy if exists "Owners view their Project Catalog" on public.owner_project_catalog;
drop policy if exists "Owners view their Topic project references" on public.owner_topic_project_references;
drop policy if exists "Owners view their POC proposals" on public.owner_poc_proposals;
create policy "Owners view their guided Topics" on public.owner_topics for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners view their guided Topic source links" on public.owner_topic_source_links for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners view their guided Topic revisions" on public.owner_topic_revisions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners view their guided Topic citations" on public.owner_topic_revision_citations for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners view their Project Catalog" on public.owner_project_catalog for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners view their Topic project references" on public.owner_topic_project_references for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners view their POC proposals" on public.owner_poc_proposals for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.owner_topics, public.owner_topic_source_links,
    public.owner_topic_revisions, public.owner_topic_revision_citations,
    public.owner_project_catalog, public.owner_topic_project_references,
    public.owner_poc_proposals from anon, authenticated;
grant select on table public.owner_topics, public.owner_topic_source_links,
    public.owner_topic_revisions, public.owner_topic_revision_citations,
    public.owner_project_catalog, public.owner_topic_project_references,
    public.owner_poc_proposals to authenticated;
grant select, insert, update, delete on table public.owner_topics,
    public.owner_topic_source_links, public.owner_topic_revisions,
    public.owner_topic_revision_citations, public.owner_project_catalog,
    public.owner_topic_project_references, public.owner_poc_proposals to service_role;

drop trigger if exists update_owner_topics_updated_at on public.owner_topics;
create trigger update_owner_topics_updated_at before update on public.owner_topics
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_topic_source_links_updated_at on public.owner_topic_source_links;
create trigger update_owner_topic_source_links_updated_at before update on public.owner_topic_source_links
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_topic_revisions_updated_at on public.owner_topic_revisions;
create trigger update_owner_topic_revisions_updated_at before update on public.owner_topic_revisions
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_topic_revision_citations_updated_at on public.owner_topic_revision_citations;
create trigger update_owner_topic_revision_citations_updated_at before update on public.owner_topic_revision_citations
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_project_catalog_updated_at on public.owner_project_catalog;
create trigger update_owner_project_catalog_updated_at before update on public.owner_project_catalog
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_topic_project_references_updated_at on public.owner_topic_project_references;
create trigger update_owner_topic_project_references_updated_at before update on public.owner_topic_project_references
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_poc_proposals_updated_at on public.owner_poc_proposals;
create trigger update_owner_poc_proposals_updated_at before update on public.owner_poc_proposals
    for each row execute procedure public.collection_update_updated_at_column();

-- M4 types must not be accepted through M2's generic decision function: an
-- acceptance has to share one transaction with its formal Topic/reference
-- writes below.
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
    if p_action in ('accept', 'edit_and_accept') and v_proposal.proposal_type in (
        'folder_assignment', 'post_learning_note', 'topic_assignment',
        'topic_knowledge_delta', 'project_reference'
    ) then raise exception 'REVIEW_PROMOTION_REQUIRED' using errcode = 'P0001'; end if;
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

create or replace function public.promote_owner_knowledge_proposal(
    p_user_id uuid, p_packet_id uuid, p_proposal_id uuid, p_action text,
    p_expected_version bigint, p_edited_payload jsonb default null
)
returns public.owner_review_packets
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
    v_packet public.owner_review_packets; v_proposal public.owner_review_proposals;
    v_payload jsonb; v_decision text; v_topic_item jsonb; v_label text;
    v_normalized_label text; v_summary text; v_claims jsonb; v_open_questions jsonb;
    v_topic_id uuid; v_project_id uuid; v_project public.owner_project_catalog;
    v_next_revision integer; v_revision_id uuid; v_remaining integer; v_seen_labels text[] := '{}'::text[];
begin
    if p_action not in ('accept', 'edit_and_accept') then raise exception 'p_action must be accept or edit_and_accept' using errcode = '22023'; end if;
    if p_expected_version is null or p_expected_version < 1 then raise exception 'p_expected_version must be positive' using errcode = '22023'; end if;
    if p_action = 'edit_and_accept' and (p_edited_payload is null or jsonb_typeof(p_edited_payload) <> 'object') then raise exception 'p_edited_payload must be an object for edit_and_accept' using errcode = '22023'; end if;
    select * into v_packet from public.owner_review_packets where id = p_packet_id and user_id = p_user_id for update;
    if v_packet.id is null or v_packet.status <> 'open' or v_packet.version <> p_expected_version then raise exception 'REVIEW_VERSION_CONFLICT' using errcode = 'P0001'; end if;
    select * into v_proposal from public.owner_review_proposals where id = p_proposal_id and packet_id = p_packet_id and user_id = p_user_id for update;
    if v_proposal.id is null or v_proposal.status not in ('pending', 'proposed') then raise exception 'REVIEW_PROPOSAL_NOT_REVIEWABLE' using errcode = 'P0001'; end if;
    if v_proposal.proposal_type not in ('topic_knowledge_delta', 'project_reference') then raise exception 'REVIEW_PROMOTION_TYPE_UNSUPPORTED' using errcode = 'P0001'; end if;
    v_payload := case when p_action = 'edit_and_accept' then p_edited_payload else v_proposal.payload end;

    if v_proposal.proposal_type = 'topic_knowledge_delta' then
        v_decision := nullif(btrim(v_payload ->> 'decision'), '');
        if v_decision not in ('recorded', 'not_needed') then raise exception 'REVIEW_TOPIC_DELTA_NOT_DECIDED' using errcode = '22023'; end if;
        if jsonb_typeof(coalesce(v_payload -> 'topics', '[]'::jsonb)) <> 'array' then raise exception 'REVIEW_TOPIC_DELTA_TOPICS_INVALID' using errcode = '22023'; end if;
        if jsonb_array_length(coalesce(v_payload -> 'topics', '[]'::jsonb)) > 3 then raise exception 'REVIEW_TOPIC_DELTA_TOPICS_LIMIT' using errcode = '22023'; end if;
        for v_topic_item in select value from jsonb_array_elements(coalesce(v_payload -> 'topics', '[]'::jsonb)) loop
            if jsonb_typeof(v_topic_item) <> 'object' then raise exception 'REVIEW_TOPIC_DELTA_ITEM_INVALID' using errcode = '22023'; end if;
            v_label := nullif(left(btrim(v_topic_item ->> 'label'), 120), '');
            if v_label is null then raise exception 'REVIEW_TOPIC_LABEL_REQUIRED' using errcode = '22023'; end if;
            v_normalized_label := lower(v_label);
            if v_normalized_label = any(v_seen_labels) then raise exception 'REVIEW_TOPIC_LABEL_DUPLICATED' using errcode = '22023'; end if;
            v_seen_labels := array_append(v_seen_labels, v_normalized_label);
            insert into public.owner_topics (user_id, label, normalized_label)
            values (p_user_id, v_label, v_normalized_label)
            on conflict (user_id, normalized_label) do update set updated_at = now()
            returning id into v_topic_id;
            perform 1 from public.owner_topics where id = v_topic_id and user_id = p_user_id for update;
            insert into public.owner_topic_source_links (user_id, topic_id, source_revision_id, origin_proposal_id)
            values (p_user_id, v_topic_id, v_packet.source_revision_id, v_proposal.id)
            on conflict (topic_id, source_revision_id) do nothing;
            if v_decision = 'recorded' then
                v_summary := nullif(left(btrim(v_topic_item ->> 'summary'), 12000), '');
                if v_summary is null then raise exception 'REVIEW_TOPIC_SUMMARY_REQUIRED' using errcode = '22023'; end if;
                v_claims := coalesce(v_topic_item -> 'claims', '[]'::jsonb);
                v_open_questions := coalesce(v_topic_item -> 'open_questions', '[]'::jsonb);
                if jsonb_typeof(v_claims) <> 'array' or jsonb_typeof(v_open_questions) <> 'array' then raise exception 'REVIEW_TOPIC_DELTA_ARRAYS_INVALID' using errcode = '22023'; end if;
                select coalesce(max(revision_number), 0) + 1 into v_next_revision from public.owner_topic_revisions where topic_id = v_topic_id;
                insert into public.owner_topic_revisions (user_id, topic_id, source_revision_id, origin_proposal_id, revision_number, summary, claims, open_questions)
                values (p_user_id, v_topic_id, v_packet.source_revision_id, v_proposal.id, v_next_revision, v_summary, v_claims, v_open_questions)
                returning id into v_revision_id;
                insert into public.owner_topic_revision_citations (user_id, topic_revision_id, source_revision_id, stance, note)
                values (p_user_id, v_revision_id, v_packet.source_revision_id, 'supporting', null);
            end if;
        end loop;
    else
        v_project_id := nullif(v_payload ->> 'project_id', '')::uuid;
        select * into v_project from public.owner_project_catalog
        where id = v_project_id and user_id = p_user_id and status = 'active';
        if v_project.id is null then raise exception 'REVIEW_PROJECT_NOT_FOUND' using errcode = 'P0001'; end if;
        if jsonb_typeof(coalesce(v_payload -> 'topic_labels', '[]'::jsonb)) <> 'array' then raise exception 'REVIEW_PROJECT_REFERENCE_TOPICS_INVALID' using errcode = '22023'; end if;
        v_summary := nullif(left(btrim(v_payload ->> 'rationale'), 4000), '');
        if v_summary is null then raise exception 'REVIEW_PROJECT_REFERENCE_RATIONALE_REQUIRED' using errcode = '22023'; end if;
        for v_topic_item in select value from jsonb_array_elements(coalesce(v_payload -> 'topic_labels', '[]'::jsonb)) loop
            v_label := nullif(left(btrim(trim(both '"' from v_topic_item::text)), 120), '');
            if v_label is null then raise exception 'REVIEW_TOPIC_LABEL_REQUIRED' using errcode = '22023'; end if;
            select id into v_topic_id from public.owner_topics where user_id = p_user_id and normalized_label = lower(v_label) and status = 'active';
            if v_topic_id is null then raise exception 'PROJECT_REFERENCE_TOPIC_NOT_FOUND' using errcode = 'P0001'; end if;
            insert into public.owner_topic_project_references (user_id, topic_id, project_id, source_revision_id, origin_proposal_id, rationale)
            values (p_user_id, v_topic_id, v_project.id, v_packet.source_revision_id, v_proposal.id, v_summary)
            on conflict (topic_id, project_id, source_revision_id) do nothing;
        end loop;
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

revoke all on function public.promote_owner_knowledge_proposal(uuid, uuid, uuid, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.promote_owner_knowledge_proposal(uuid, uuid, uuid, text, bigint, jsonb) to service_role;

commit;
