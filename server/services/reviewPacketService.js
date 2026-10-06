import { supabase as defaultSupabase } from '../supabaseClient.js';

export const PROPOSAL_STATUSES = new Set(['pending', 'proposed', 'accepted', 'rejected', 'superseded']);
export const PACKET_STATUSES = new Set(['open', 'deferred', 'completed']);
const ACTIONS = new Set(['accept', 'reject', 'edit_and_accept']);

function requireText(value, name, maxLength = 256) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        throw new Error(`${name} must be a non-empty string up to ${maxLength} characters`);
    }
    return value.trim();
}

function requireVersion(value) {
    const version = Number(value);
    if (!Number.isInteger(version) || version < 1) throw new Error('expectedVersion must be a positive integer');
    return version;
}

function requireObject(value, name, allowNull = false) {
    if (allowNull && value == null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${name} must be an object`);
    }
    return value;
}

function mapPacket(packet) {
    if (!packet) return null;
    const proposals = packet.proposals || packet.owner_review_proposals || [];
    const checkpoints = packet.checkpoints || packet.owner_review_checkpoints || [];
    const sourceRevision = packet.source_revision || packet.collection_source_revisions || null;
    return {
        ...packet,
        proposals: Array.isArray(proposals) ? proposals : [],
        checkpoints: Array.isArray(checkpoints) ? checkpoints : [],
        source_revision: Array.isArray(sourceRevision) ? sourceRevision[0] || null : sourceRevision,
        next_action: deriveNextAction({ ...packet, proposals, checkpoints, source_revision: sourceRevision })
    };
}

export function deriveNextAction(packet) {
    const packetId = packet?.id || null;
    if (packet?.status === 'completed') {
        return { kind: 'packet_complete', packet_id: packetId, reason: 'all_current_proposals_decided' };
    }
    if (packet?.status === 'deferred') {
        return { kind: 'resume_deferred', packet_id: packetId, reason: 'owner_deferred' };
    }
    const quality = packet?.source_revision?.capture_quality || packet?.capture_quality;
    if (quality === 'partial') {
        return { kind: 'repair_source', packet_id: packetId, reason: 'source_is_partial' };
    }
    const proposals = Array.isArray(packet?.proposals) ? packet.proposals : [];
    const reviewable = proposals.find(proposal => proposal?.status === 'proposed' || proposal?.status === 'pending');
    if (reviewable) {
        return {
            kind: 'review_proposal',
            packet_id: packetId,
            proposal_id: reviewable.id,
            proposal_type: reviewable.proposal_type,
            reason: 'owner_decision_required'
        };
    }
    return { kind: 'awaiting_proposals', packet_id: packetId, reason: 'no_pending_proposal' };
}

function rpcFailure(action, error) {
    const wrapped = new Error(`${action} failed: ${error?.message || 'unknown database error'}`);
    wrapped.code = error?.code;
    throw wrapped;
}

async function mutationPacketOrFallback({ userId, packet, supabaseClient }) {
    const fallback = { ...packet, next_action: deriveNextAction(packet) };
    if (typeof supabaseClient?.from !== 'function' || !packet?.id) return fallback;
    try {
        return (await loadReviewPacket({ userId, packetId: packet.id, supabaseClient })) || fallback;
    } catch {
        // A decision has already committed. The caller can safely render the
        // deterministic packet-level fallback and refresh later.
        return fallback;
    }
}

export async function listReviewPackets({ userId, limit = 20, supabaseClient = defaultSupabase }) {
    requireText(userId, 'userId', 80);
    const boundedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const { data, error } = await supabaseClient
        .from('owner_review_packets')
        .select(`
            id, user_id, source_revision_id, post_id, status, version, deferred_until, deferred_reason, created_at, updated_at,
            collection_source_revisions (id, capture_quality),
            owner_review_proposals (id, proposal_type, status, created_at),
            owner_review_checkpoints (id, checkpoint_key, status, updated_at)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(boundedLimit);
    if (error) rpcFailure('Review packet list', error);
    return (data || []).map(mapPacket);
}

export async function loadReviewPacket({ userId, packetId, supabaseClient = defaultSupabase }) {
    requireText(userId, 'userId', 80);
    requireText(packetId, 'packetId', 128);
    const { data, error } = await supabaseClient
        .from('owner_review_packets')
        .select(`
            id, user_id, source_revision_id, post_id, status, version, deferred_until, deferred_reason, created_at, updated_at,
            collection_source_revisions (id, capture_quality, source_payload, created_at),
            owner_review_proposals (*),
            owner_review_checkpoints (*)
        `)
        .eq('id', packetId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) rpcFailure('Review packet lookup', error);
    return mapPacket(data);
}

export async function ensureReviewPacket({ userId, sourceRevisionId, supabaseClient = defaultSupabase }) {
    requireText(userId, 'userId', 80);
    requireText(sourceRevisionId, 'sourceRevisionId', 128);
    const { data, error } = await supabaseClient.rpc('ensure_owner_review_packet', {
        p_user_id: userId,
        p_source_revision_id: sourceRevisionId
    }).single();
    if (error) rpcFailure('Review packet creation', error);
    return data;
}

export async function createReviewProposal({
    userId,
    packetId,
    proposalType,
    payload,
    idempotencyKey,
    supabaseClient = defaultSupabase
}) {
    requireText(userId, 'userId', 80);
    requireText(packetId, 'packetId', 128);
    requireText(proposalType, 'proposalType', 80);
    requireObject(payload, 'payload');
    requireText(idempotencyKey, 'idempotencyKey', 128);
    const { data, error } = await supabaseClient.rpc('create_owner_review_proposal', {
        p_user_id: userId,
        p_packet_id: packetId,
        p_proposal_type: proposalType,
        p_payload: payload,
        p_idempotency_key: idempotencyKey
    }).single();
    if (error) rpcFailure('Review proposal creation', error);
    return data;
}

export async function deferReviewPacket({
    userId,
    packetId,
    expectedVersion,
    reason = null,
    deferredUntil = null,
    supabaseClient = defaultSupabase
}) {
    requireText(userId, 'userId', 80);
    requireText(packetId, 'packetId', 128);
    const { data, error } = await supabaseClient.rpc('defer_owner_review_packet', {
        p_user_id: userId,
        p_packet_id: packetId,
        p_expected_version: requireVersion(expectedVersion),
        p_reason: reason == null ? null : requireText(reason, 'reason', 1_000),
        p_deferred_until: deferredUntil || null
    }).single();
    if (error) rpcFailure('Review packet defer', error);
    return mutationPacketOrFallback({ userId, packet: data, supabaseClient });
}

export async function resumeReviewPacket({ userId, packetId, expectedVersion, supabaseClient = defaultSupabase }) {
    requireText(userId, 'userId', 80);
    requireText(packetId, 'packetId', 128);
    const { data, error } = await supabaseClient.rpc('resume_owner_review_packet', {
        p_user_id: userId,
        p_packet_id: packetId,
        p_expected_version: requireVersion(expectedVersion)
    }).single();
    if (error) rpcFailure('Review packet resume', error);
    return mutationPacketOrFallback({ userId, packet: data, supabaseClient });
}

export async function decideReviewProposal({
    userId,
    packetId,
    proposalId,
    action,
    expectedVersion,
    editedPayload = null,
    supabaseClient = defaultSupabase
}) {
    requireText(userId, 'userId', 80);
    requireText(packetId, 'packetId', 128);
    requireText(proposalId, 'proposalId', 128);
    if (!ACTIONS.has(action)) throw new Error('action must be accept, reject, or edit_and_accept');
    if (action === 'edit_and_accept') requireObject(editedPayload, 'editedPayload');
    const { data, error } = await supabaseClient.rpc('transition_owner_review_proposal', {
        p_user_id: userId,
        p_packet_id: packetId,
        p_proposal_id: proposalId,
        p_action: action,
        p_expected_version: requireVersion(expectedVersion),
        p_edited_payload: requireObject(editedPayload, 'editedPayload', true)
    }).single();
    if (error) rpcFailure('Review proposal decision', error);
    return mutationPacketOrFallback({ userId, packet: data, supabaseClient });
}
