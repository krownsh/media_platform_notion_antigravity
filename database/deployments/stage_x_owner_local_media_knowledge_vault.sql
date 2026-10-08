-- Owner-guided local Media Knowledge Vault.
--
-- This deployment adds durable owner-scoped manifests, append-only event
-- records, and reviewable local-change candidates. It intentionally does not
-- migrate, rewrite, or delete legacy wiki/threads content.

begin;

create table if not exists public.owner_local_note_manifests (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    note_kind text not null check (note_kind in ('post_case_file', 'topic_note', 'project_note')),
    stable_file_id uuid not null default uuid_generate_v4(),
    post_id uuid references public.collection_posts(id) on delete cascade,
    source_revision_id uuid references public.collection_source_revisions(id) on delete restrict,
    workflow_id uuid references public.collection_post_workflows(id) on delete set null,
    topic_id uuid references public.owner_topics(id) on delete cascade,
    project_id uuid references public.owner_project_catalog(id) on delete cascade,
    title_status text not null default 'provisional' check (title_status in ('provisional', 'accepted')),
    primary_folder text not null default 'Inbox' check (char_length(btrim(primary_folder)) between 1 and 160),
    relative_path text check (relative_path is null or (char_length(btrim(relative_path)) between 1 and 2048 and relative_path !~ '(^|/)\\.\\.(/|$)' and relative_path !~ '^/')),
    sync_state text not null default 'pending' check (sync_state in ('pending', 'synchronized', 'local_change_pending', 'conflict', 'failed')),
    last_written_event_sequence bigint not null default 0 check (last_written_event_sequence >= 0),
    last_content_sha256 text check (last_content_sha256 is null or last_content_sha256 ~ '^[a-f0-9]{64}$'),
    last_error text check (last_error is null or char_length(last_error) <= 4000),
    version bigint not null default 1 check (version >= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        (note_kind = 'post_case_file' and post_id is not null and source_revision_id is not null)
        or (note_kind = 'topic_note' and topic_id is not null)
        or (note_kind = 'project_note' and project_id is not null)
    ),
    unique (stable_file_id),
    unique (user_id, post_id),
    unique (user_id, topic_id),
    unique (user_id, project_id)
);
comment on table public.owner_local_note_manifests is
    'Owner-scoped manifest for one local Markdown note. It stores only a relative path and checksum; the browser never receives a writable absolute filesystem path.';

create table if not exists public.owner_local_note_events (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    manifest_id uuid not null references public.owner_local_note_manifests(id) on delete cascade,
    source_revision_id uuid references public.collection_source_revisions(id) on delete restrict,
    review_packet_id uuid references public.owner_review_packets(id) on delete set null,
    proposal_id uuid references public.owner_review_proposals(id) on delete set null,
    sequence bigint not null check (sequence > 0),
    event_type text not null check (event_type in ('capture', 'analysis', 'discussion', 'proposal', 'decision', 'research', 'poc', 'rename_move', 'delivery', 'conflict_resolution')),
    event_status text not null check (event_status in ('candidate', 'accepted', 'rejected', 'recorded', 'failed', 'superseded')),
    actor_kind text not null check (actor_kind in ('system', 'agent', 'owner')),
    actor_id text,
    event_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload) = 'object'),
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (manifest_id, sequence)
);
comment on table public.owner_local_note_events is
    'Append-only event ledger rendered into a local post case file. Historic event payloads are never rewritten after insertion.';
comment on column public.owner_local_note_events.event_payload is
    'JSON object with schema_version, optional full post-scoped Owner/agent messages, concise conclusion, linked entity IDs, outcome, limitations, and rendering-safe source facts. Candidate content remains labelled by event_status.';

create table if not exists public.owner_local_note_change_candidates (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    manifest_id uuid not null references public.owner_local_note_manifests(id) on delete cascade,
    base_content_sha256 text not null check (base_content_sha256 ~ '^[a-f0-9]{64}$'),
    candidate_content text not null check (char_length(candidate_content) <= 200000),
    diff_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(diff_summary) = 'object'),
    status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected', 'superseded')),
    version bigint not null default 1 check (version >= 1),
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
comment on table public.owner_local_note_change_candidates is
    'Owner-reviewable free-notes mirror candidate or managed-block integrity conflict. It is not searchable or formal knowledge until explicitly accepted.';
comment on column public.owner_local_note_change_candidates.diff_summary is
    'JSON object describing the local scan: schema_version, change_kind (free_notes or managed_conflict), base and observed checksums, and bounded diff metadata. It must not grant arbitrary path access.';

create index if not exists owner_local_note_manifests_user_state_idx
    on public.owner_local_note_manifests (user_id, sync_state, updated_at desc);
create index if not exists owner_local_note_events_manifest_sequence_idx
    on public.owner_local_note_events (manifest_id, sequence asc);
create index if not exists owner_local_note_change_candidates_manifest_status_idx
    on public.owner_local_note_change_candidates (manifest_id, status, updated_at desc);

create or replace function public.append_owner_local_note_event(
    p_user_id uuid,
    p_manifest_id uuid,
    p_event_type text,
    p_event_status text,
    p_actor_kind text,
    p_actor_id text default null,
    p_event_payload jsonb default '{}'::jsonb,
    p_source_revision_id uuid default null,
    p_review_packet_id uuid default null,
    p_proposal_id uuid default null,
    p_occurred_at timestamptz default null
)
returns public.owner_local_note_events
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
    v_manifest public.owner_local_note_manifests;
    v_event public.owner_local_note_events;
    v_sequence bigint;
begin
    if p_event_payload is null or jsonb_typeof(p_event_payload) <> 'object' then
        raise exception 'LOCAL_NOTE_EVENT_PAYLOAD_INVALID' using errcode = '22023';
    end if;
    select * into v_manifest
    from public.owner_local_note_manifests
    where id = p_manifest_id and user_id = p_user_id
    for update;
    if v_manifest.id is null then
        raise exception 'LOCAL_NOTE_MANIFEST_NOT_FOUND' using errcode = 'P0001';
    end if;
    select coalesce(max(sequence), 0) + 1 into v_sequence
    from public.owner_local_note_events
    where manifest_id = v_manifest.id;
    insert into public.owner_local_note_events (
        user_id, manifest_id, source_revision_id, review_packet_id, proposal_id,
        sequence, event_type, event_status, actor_kind, actor_id, event_payload,
        occurred_at
    ) values (
        p_user_id, v_manifest.id, p_source_revision_id, p_review_packet_id,
        p_proposal_id, v_sequence, p_event_type, p_event_status, p_actor_kind,
        nullif(btrim(p_actor_id), ''), p_event_payload, coalesce(p_occurred_at, now())
    ) returning * into v_event;
    update public.owner_local_note_manifests
    set version = version + 1,
        updated_at = now()
    where id = v_manifest.id;
    return v_event;
end;
$$;

alter table public.owner_local_note_manifests enable row level security;
alter table public.owner_local_note_events enable row level security;
alter table public.owner_local_note_change_candidates enable row level security;

drop policy if exists "Owners view their local media owner_local_note_manifests" on public.owner_local_note_manifests;
drop policy if exists "Owners view their local media owner_local_note_events" on public.owner_local_note_events;
drop policy if exists "Owners view their local media owner_local_note_change_candidates" on public.owner_local_note_change_candidates;
create policy "Owners view their local media owner_local_note_manifests" on public.owner_local_note_manifests for select to authenticated
    using ((select auth.uid()) = user_id);
create policy "Owners view their local media owner_local_note_events" on public.owner_local_note_events for select to authenticated
    using ((select auth.uid()) = user_id);
create policy "Owners view their local media owner_local_note_change_candidates" on public.owner_local_note_change_candidates for select to authenticated
    using ((select auth.uid()) = user_id);

revoke all on table public.owner_local_note_manifests, public.owner_local_note_events,
    public.owner_local_note_change_candidates from public, anon, authenticated;
grant select on table public.owner_local_note_manifests, public.owner_local_note_events,
    public.owner_local_note_change_candidates to authenticated;
grant select, insert, update, delete on table public.owner_local_note_manifests,
    public.owner_local_note_events, public.owner_local_note_change_candidates to service_role;
revoke all on function public.append_owner_local_note_event(uuid, uuid, text, text, text, text, jsonb, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.append_owner_local_note_event(uuid, uuid, text, text, text, text, jsonb, uuid, uuid, uuid, timestamptz) to service_role;

drop trigger if exists update_owner_local_note_manifests_updated_at on public.owner_local_note_manifests;
create trigger update_owner_local_note_manifests_updated_at before update on public.owner_local_note_manifests
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_local_note_events_updated_at on public.owner_local_note_events;
create trigger update_owner_local_note_events_updated_at before update on public.owner_local_note_events
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_local_note_change_candidates_updated_at on public.owner_local_note_change_candidates;
create trigger update_owner_local_note_change_candidates_updated_at before update on public.owner_local_note_change_candidates
    for each row execute procedure public.collection_update_updated_at_column();

commit;
