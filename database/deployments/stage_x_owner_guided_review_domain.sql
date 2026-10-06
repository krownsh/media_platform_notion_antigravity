-- Owner-guided review domain (M2).
-- Apply after stage_x_owner_guided_capture_cutover.sql. This is additive: it
-- records proposals and Owner decisions only. It deliberately creates no
-- trigger or function that writes a formal folder, post note, Topic, project,
-- repository, or POC record.

begin;

create table if not exists public.owner_review_packets (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_revision_id uuid not null references public.collection_source_revisions(id) on delete restrict,
    post_id uuid not null references public.collection_posts(id) on delete restrict,
    status text not null default 'open' check (status in ('open', 'deferred', 'completed')),
    version bigint not null default 1 check (version >= 1),
    deferred_until timestamptz,
    deferred_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, source_revision_id)
);

comment on table public.owner_review_packets is
    'One resumable Owner decision packet per captured source revision. A packet is a review process, not formal knowledge or organization state.';
comment on column public.owner_review_packets.version is
    'Optimistic-lock version. Review mutations must supply the current version so concurrent Owner/agent actions cannot silently overwrite each other.';

create table if not exists public.owner_review_proposals (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    packet_id uuid not null references public.owner_review_packets(id) on delete cascade,
    proposal_type text not null check (char_length(proposal_type) between 1 and 80),
    status text not null default 'proposed'
        check (status in ('pending', 'proposed', 'accepted', 'rejected', 'superseded')),
    payload jsonb not null default '{}'::jsonb,
    idempotency_key text not null check (char_length(idempotency_key) between 1 and 128),
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, idempotency_key)
);

comment on table public.owner_review_proposals is
    'Candidate decision only. Accepted means the Owner approved this candidate for a later, explicit promotion handler; it does not itself mutate a formal record.';
comment on column public.owner_review_proposals.payload is
    'JSONB proposal schema is namespaced by proposal_type. It may contain suggested values, evidence, confidence, and rationale; it must not contain a formal-record write instruction.';

create table if not exists public.owner_review_approvals (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    packet_id uuid not null references public.owner_review_packets(id) on delete cascade,
    proposal_id uuid not null references public.owner_review_proposals(id) on delete cascade,
    decision text not null check (decision in ('accepted', 'rejected')),
    decided_by uuid not null references auth.users(id) on delete restrict,
    edited_payload jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.owner_review_approvals is
    'Append-only Owner decision evidence. edited_payload is a JSONB copy of the Owner-edited candidate and is never applied to a formal record by this domain.';

create table if not exists public.owner_review_checkpoints (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    packet_id uuid not null references public.owner_review_packets(id) on delete cascade,
    checkpoint_key text not null check (char_length(checkpoint_key) between 1 and 80),
    status text not null default 'pending' check (status in ('pending', 'deferred', 'completed')),
    context jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (packet_id, checkpoint_key)
);

comment on column public.owner_review_checkpoints.context is
    'JSONB resume context such as reason, next action, or non-sensitive display state. It does not contain credentials or any formal-record mutation instruction.';

create table if not exists public.owner_review_audit_events (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    packet_id uuid not null references public.owner_review_packets(id) on delete cascade,
    proposal_id uuid references public.owner_review_proposals(id) on delete set null,
    event_type text not null check (char_length(event_type) between 1 and 120),
    actor_id uuid not null references auth.users(id) on delete restrict,
    event_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.owner_review_audit_events.event_data is
    'JSONB event envelope: schema_version, packet_version, action, and safe decision metadata. It is audit evidence only and cannot instruct a formal write.';

create index if not exists owner_review_packets_user_updated_idx on public.owner_review_packets (user_id, updated_at desc);
create index if not exists owner_review_proposals_packet_status_idx on public.owner_review_proposals (packet_id, status, created_at);
create index if not exists owner_review_audit_events_packet_created_idx on public.owner_review_audit_events (packet_id, created_at);

alter table public.owner_review_packets enable row level security;
alter table public.owner_review_proposals enable row level security;
alter table public.owner_review_approvals enable row level security;
alter table public.owner_review_checkpoints enable row level security;
alter table public.owner_review_audit_events enable row level security;

drop policy if exists "Owners manage their review packets" on public.owner_review_packets;
drop policy if exists "Owners view their review packets" on public.owner_review_packets;
create policy "Owners view their review packets" on public.owner_review_packets for select to authenticated
    using ((select auth.uid()) = user_id);
drop policy if exists "Owners manage their review proposals" on public.owner_review_proposals;
drop policy if exists "Owners view their review proposals" on public.owner_review_proposals;
create policy "Owners view their review proposals" on public.owner_review_proposals for select to authenticated
    using ((select auth.uid()) = user_id);
drop policy if exists "Owners view their review approvals" on public.owner_review_approvals;
create policy "Owners view their review approvals" on public.owner_review_approvals for select to authenticated
    using ((select auth.uid()) = user_id);
drop policy if exists "Owners view their review checkpoints" on public.owner_review_checkpoints;
create policy "Owners view their review checkpoints" on public.owner_review_checkpoints for select to authenticated
    using ((select auth.uid()) = user_id);
drop policy if exists "Owners view their review audit events" on public.owner_review_audit_events;
create policy "Owners view their review audit events" on public.owner_review_audit_events for select to authenticated
    using ((select auth.uid()) = user_id);

-- Keep the review domain readable to its Owner, while only the trusted server
-- service role can invoke its mutation RPCs. These explicit grants are needed
-- for Supabase projects that no longer auto-expose new public tables.
revoke all on table public.owner_review_packets from anon, authenticated;
revoke all on table public.owner_review_proposals from anon, authenticated;
revoke all on table public.owner_review_approvals from anon, authenticated;
revoke all on table public.owner_review_checkpoints from anon, authenticated;
revoke all on table public.owner_review_audit_events from anon, authenticated;
grant select on table public.owner_review_packets, public.owner_review_proposals,
    public.owner_review_approvals, public.owner_review_checkpoints,
    public.owner_review_audit_events to authenticated;
grant select, insert, update, delete on table public.owner_review_packets,
    public.owner_review_proposals, public.owner_review_approvals,
    public.owner_review_checkpoints, public.owner_review_audit_events to service_role;

drop trigger if exists update_owner_review_packets_updated_at on public.owner_review_packets;
create trigger update_owner_review_packets_updated_at before update on public.owner_review_packets
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_review_proposals_updated_at on public.owner_review_proposals;
create trigger update_owner_review_proposals_updated_at before update on public.owner_review_proposals
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_review_approvals_updated_at on public.owner_review_approvals;
create trigger update_owner_review_approvals_updated_at before update on public.owner_review_approvals
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_review_checkpoints_updated_at on public.owner_review_checkpoints;
create trigger update_owner_review_checkpoints_updated_at before update on public.owner_review_checkpoints
    for each row execute procedure public.collection_update_updated_at_column();
drop trigger if exists update_owner_review_audit_events_updated_at on public.owner_review_audit_events;
create trigger update_owner_review_audit_events_updated_at before update on public.owner_review_audit_events
    for each row execute procedure public.collection_update_updated_at_column();

create or replace function public.ensure_owner_review_packet(
    p_user_id uuid,
    p_source_revision_id uuid
)
returns public.owner_review_packets
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
    v_packet public.owner_review_packets;
    v_post_id uuid;
begin
    if p_user_id is null or p_source_revision_id is null then
        raise exception 'p_user_id and p_source_revision_id are required' using errcode = '22023';
    end if;
    select post_id into v_post_id from public.collection_source_revisions
    where id = p_source_revision_id and user_id = p_user_id;
    if v_post_id is null then
        raise exception 'REVIEW_SOURCE_NOT_FOUND' using errcode = 'P0001';
    end if;

    insert into public.owner_review_packets (user_id, source_revision_id, post_id)
    values (p_user_id, p_source_revision_id, v_post_id)
    on conflict (user_id, source_revision_id) do nothing
    returning * into v_packet;
    if v_packet.id is null then
        select * into v_packet from public.owner_review_packets
        where user_id = p_user_id and source_revision_id = p_source_revision_id;
        return v_packet;
    end if;

    insert into public.owner_review_checkpoints (user_id, packet_id, checkpoint_key, context)
    values (p_user_id, v_packet.id, 'source_readiness', jsonb_build_object('schema_version', 1));
    insert into public.owner_review_audit_events (user_id, packet_id, event_type, actor_id, event_data)
    values (p_user_id, v_packet.id, 'packet.created', p_user_id,
        jsonb_build_object('schema_version', 1, 'packet_version', v_packet.version));
    return v_packet;
end;
$$;

create or replace function public.create_owner_review_proposal(
    p_user_id uuid,
    p_packet_id uuid,
    p_proposal_type text,
    p_payload jsonb,
    p_idempotency_key text
)
returns public.owner_review_proposals
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
    v_packet public.owner_review_packets;
    v_proposal public.owner_review_proposals;
begin
    if p_user_id is null or p_packet_id is null then
        raise exception 'p_user_id and p_packet_id are required' using errcode = '22023';
    end if;
    if nullif(btrim(p_proposal_type), '') is null or char_length(p_proposal_type) > 80 then
        raise exception 'p_proposal_type must be 1-80 characters' using errcode = '22023';
    end if;
    if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
        raise exception 'p_payload must be an object' using errcode = '22023';
    end if;
    if nullif(btrim(p_idempotency_key), '') is null or char_length(p_idempotency_key) > 128 then
        raise exception 'p_idempotency_key must be 1-128 characters' using errcode = '22023';
    end if;
    -- Return an earlier result before checking packet state. A caller may have
    -- lost the original response and retry only after that proposal was
    -- decided and the packet completed.
    select * into v_proposal from public.owner_review_proposals
    where user_id = p_user_id and idempotency_key = btrim(p_idempotency_key);
    if v_proposal.id is not null then
        if v_proposal.packet_id <> p_packet_id then
            raise exception 'REVIEW_IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
        end if;
        return v_proposal;
    end if;
    select * into v_packet from public.owner_review_packets
    where id = p_packet_id and user_id = p_user_id for update;
    if v_packet.id is null then
        raise exception 'REVIEW_PACKET_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_packet.status <> 'open' then
        raise exception 'REVIEW_PACKET_NOT_OPEN' using errcode = 'P0001';
    end if;

    insert into public.owner_review_proposals (user_id, packet_id, proposal_type, payload, idempotency_key)
    values (p_user_id, p_packet_id, btrim(p_proposal_type), p_payload, btrim(p_idempotency_key))
    on conflict (user_id, idempotency_key) do nothing
    returning * into v_proposal;
    if v_proposal.id is null then
        select * into v_proposal from public.owner_review_proposals
        where user_id = p_user_id and idempotency_key = btrim(p_idempotency_key);
        if v_proposal.packet_id <> p_packet_id then
            raise exception 'REVIEW_IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
        end if;
        return v_proposal;
    end if;

    update public.owner_review_packets set version = version + 1, updated_at = now()
    where id = p_packet_id and user_id = p_user_id;
    insert into public.owner_review_audit_events (user_id, packet_id, proposal_id, event_type, actor_id, event_data)
    values (p_user_id, p_packet_id, v_proposal.id, 'proposal.created', p_user_id,
        jsonb_build_object('schema_version', 1, 'packet_version', v_packet.version + 1, 'proposal_type', v_proposal.proposal_type));
    return v_proposal;
end;
$$;

create or replace function public.defer_owner_review_packet(
    p_user_id uuid,
    p_packet_id uuid,
    p_expected_version bigint,
    p_reason text default null,
    p_deferred_until timestamptz default null
)
returns public.owner_review_packets
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_packet public.owner_review_packets;
begin
    if p_expected_version is null or p_expected_version < 1 then
        raise exception 'p_expected_version must be positive' using errcode = '22023';
    end if;
    update public.owner_review_packets
    set status = 'deferred', deferred_reason = nullif(left(btrim(coalesce(p_reason, '')), 1000), ''),
        deferred_until = p_deferred_until, version = version + 1, updated_at = now()
    where id = p_packet_id and user_id = p_user_id and status = 'open' and version = p_expected_version
    returning * into v_packet;
    if v_packet.id is null then
        raise exception 'REVIEW_VERSION_CONFLICT' using errcode = 'P0001';
    end if;
    update public.owner_review_checkpoints set status = 'deferred', updated_at = now()
    where packet_id = p_packet_id and user_id = p_user_id and status = 'pending';
    insert into public.owner_review_audit_events (user_id, packet_id, event_type, actor_id, event_data)
    values (p_user_id, p_packet_id, 'packet.deferred', p_user_id,
        jsonb_build_object('schema_version', 1, 'packet_version', v_packet.version, 'reason', v_packet.deferred_reason));
    return v_packet;
end;
$$;

create or replace function public.resume_owner_review_packet(
    p_user_id uuid,
    p_packet_id uuid,
    p_expected_version bigint
)
returns public.owner_review_packets
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_packet public.owner_review_packets;
begin
    if p_expected_version is null or p_expected_version < 1 then
        raise exception 'p_expected_version must be positive' using errcode = '22023';
    end if;
    update public.owner_review_packets
    set status = 'open', deferred_reason = null, deferred_until = null,
        version = version + 1, updated_at = now()
    where id = p_packet_id and user_id = p_user_id and status = 'deferred' and version = p_expected_version
    returning * into v_packet;
    if v_packet.id is null then
        raise exception 'REVIEW_VERSION_CONFLICT' using errcode = 'P0001';
    end if;
    update public.owner_review_checkpoints set status = 'pending', updated_at = now()
    where packet_id = p_packet_id and user_id = p_user_id and status = 'deferred';
    insert into public.owner_review_audit_events (user_id, packet_id, event_type, actor_id, event_data)
    values (p_user_id, p_packet_id, 'packet.resumed', p_user_id,
        jsonb_build_object('schema_version', 1, 'packet_version', v_packet.version));
    return v_packet;
end;
$$;

create or replace function public.transition_owner_review_proposal(
    p_user_id uuid,
    p_packet_id uuid,
    p_proposal_id uuid,
    p_action text,
    p_expected_version bigint,
    p_edited_payload jsonb default null
)
returns public.owner_review_packets
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
    v_packet public.owner_review_packets;
    v_proposal public.owner_review_proposals;
    v_decision text;
    v_remaining integer;
begin
    if p_action not in ('accept', 'reject', 'edit_and_accept') then
        raise exception 'p_action is invalid' using errcode = '22023';
    end if;
    if p_expected_version is null or p_expected_version < 1 then
        raise exception 'p_expected_version must be positive' using errcode = '22023';
    end if;
    if p_action = 'edit_and_accept' and (p_edited_payload is null or jsonb_typeof(p_edited_payload) <> 'object') then
        raise exception 'p_edited_payload must be an object for edit_and_accept' using errcode = '22023';
    end if;
    select * into v_packet from public.owner_review_packets
    where id = p_packet_id and user_id = p_user_id for update;
    if v_packet.id is null or v_packet.status <> 'open' or v_packet.version <> p_expected_version then
        raise exception 'REVIEW_VERSION_CONFLICT' using errcode = 'P0001';
    end if;
    select * into v_proposal from public.owner_review_proposals
    where id = p_proposal_id and packet_id = p_packet_id and user_id = p_user_id for update;
    if v_proposal.id is null or v_proposal.status not in ('pending', 'proposed') then
        raise exception 'REVIEW_PROPOSAL_NOT_REVIEWABLE' using errcode = 'P0001';
    end if;

    v_decision := case when p_action = 'reject' then 'rejected' else 'accepted' end;
    update public.owner_review_proposals
    set status = v_decision, reviewed_at = now(),
        payload = case when p_action = 'edit_and_accept' then p_edited_payload else payload end,
        updated_at = now()
    where id = v_proposal.id;
    insert into public.owner_review_approvals (user_id, packet_id, proposal_id, decision, decided_by, edited_payload)
    values (p_user_id, p_packet_id, p_proposal_id, v_decision, p_user_id,
        case when p_action = 'edit_and_accept' then p_edited_payload else null end);
    select count(*) into v_remaining from public.owner_review_proposals
    where packet_id = p_packet_id and user_id = p_user_id and status in ('pending', 'proposed');
    update public.owner_review_packets
    set status = case when v_remaining = 0 then 'completed' else 'open' end,
        version = version + 1, updated_at = now()
    where id = p_packet_id and user_id = p_user_id
    returning * into v_packet;
    insert into public.owner_review_audit_events (user_id, packet_id, proposal_id, event_type, actor_id, event_data)
    values (p_user_id, p_packet_id, p_proposal_id, 'proposal.' || v_decision, p_user_id,
        jsonb_build_object('schema_version', 1, 'packet_version', v_packet.version, 'action', p_action));
    return v_packet;
end;
$$;

revoke all on function public.ensure_owner_review_packet(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_owner_review_proposal(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.defer_owner_review_packet(uuid, uuid, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.resume_owner_review_packet(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.transition_owner_review_proposal(uuid, uuid, uuid, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.ensure_owner_review_packet(uuid, uuid) to service_role;
grant execute on function public.create_owner_review_proposal(uuid, uuid, text, jsonb, text) to service_role;
grant execute on function public.defer_owner_review_packet(uuid, uuid, bigint, text, timestamptz) to service_role;
grant execute on function public.resume_owner_review_packet(uuid, uuid, bigint) to service_role;
grant execute on function public.transition_owner_review_proposal(uuid, uuid, uuid, text, bigint, jsonb) to service_role;

commit;
