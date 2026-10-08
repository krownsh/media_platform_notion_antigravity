import { supabase as defaultSupabase } from '../supabaseClient.js';

function requiredText(value, label) {
    const normalized = String(value || '').trim();
    if (!normalized) throw new Error(`${label} is required`);
    return normalized;
}

export async function createPostCaseFileManifest({
    userId,
    postId,
    sourceRevisionId,
    workflowId = null,
    supabaseClient = defaultSupabase
}) {
    const payload = {
        user_id: requiredText(userId, 'userId'),
        note_kind: 'post_case_file',
        post_id: requiredText(postId, 'postId'),
        source_revision_id: requiredText(sourceRevisionId, 'sourceRevisionId'),
        workflow_id: workflowId ? requiredText(workflowId, 'workflowId') : null,
        title_status: 'provisional',
        primary_folder: 'Inbox',
        relative_path: null,
        sync_state: 'pending',
        last_error: null
    };
    const { data, error } = await supabaseClient
        .from('owner_local_note_manifests')
        .upsert(payload, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
        .select()
        .maybeSingle();
    if (error) throw new Error(`Local note manifest creation failed: ${error.message}`);
    if (data) return data;

    const { data: existing, error: existingError } = await supabaseClient
        .from('owner_local_note_manifests')
        .select()
        .eq('user_id', payload.user_id)
        .eq('post_id', payload.post_id)
        .maybeSingle();
    if (existingError) throw new Error(`Local note manifest lookup failed: ${existingError.message}`);
    if (!existing) throw new Error('Local note manifest was not returned after idempotent creation');
    return existing;
}

function optionalText(value, label) {
    if (value === null || value === undefined || value === '') return null;
    return requiredText(value, label);
}

function objectPayload(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('eventPayload must be an object');
    }
    return value;
}

function expectedManifestVersion(value) {
    const version = Number(value);
    if (!Number.isInteger(version) || version < 1) throw new Error('expectedVersion must be a positive integer');
    return version;
}

function safeRelativePath(value) {
    const normalized = String(value || '').trim().replace(/\\/g, '/');
    if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
        throw new Error('relativePath must be a safe relative path');
    }
    return normalized;
}

function sha256(value) {
    const checksum = String(value || '').trim();
    if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error('checksum must be a lowercase SHA-256 digest');
    return checksum;
}

async function updateManifestAtExpectedVersion({ userId, manifestId, expectedVersion, payload, supabaseClient }) {
    const version = expectedManifestVersion(expectedVersion);
    const { data, error } = await supabaseClient
        .from('owner_local_note_manifests')
        .update({ ...payload, version: version + 1 })
        .eq('id', requiredText(manifestId, 'manifestId'))
        .eq('user_id', requiredText(userId, 'userId'))
        .eq('version', version)
        .select()
        .maybeSingle();
    if (error) throw new Error(`Local note manifest update failed: ${error.message}`);
    if (!data) {
        const conflict = new Error('LOCAL_NOTE_VERSION_CONFLICT');
        conflict.code = 'LOCAL_NOTE_VERSION_CONFLICT';
        throw conflict;
    }
    return data;
}

export async function recordLocalNoteDelivery({
    userId,
    manifestId,
    expectedVersion,
    relativePath,
    checksum,
    lastWrittenEventSequence = 0,
    supabaseClient = defaultSupabase
}) {
    const sequence = Number(lastWrittenEventSequence);
    if (!Number.isInteger(sequence) || sequence < 0) throw new Error('lastWrittenEventSequence must be a non-negative integer');
    return updateManifestAtExpectedVersion({
        userId,
        manifestId,
        expectedVersion,
        supabaseClient,
        payload: {
            relative_path: safeRelativePath(relativePath),
            last_content_sha256: sha256(checksum),
            last_written_event_sequence: sequence,
            sync_state: 'synchronized',
            last_error: null
        }
    });
}

export async function recordLocalNoteFailure({
    userId,
    manifestId,
    expectedVersion,
    error,
    supabaseClient = defaultSupabase
}) {
    const message = String(error || 'Local note delivery failed').replace(/\0/g, '').trim().slice(0, 4000);
    return updateManifestAtExpectedVersion({
        userId,
        manifestId,
        expectedVersion,
        supabaseClient,
        payload: { sync_state: 'failed', last_error: message || 'Local note delivery failed' }
    });
}

export async function appendLocalNoteEvent({
    userId,
    manifestId,
    eventType,
    eventStatus,
    actorKind,
    actorId = null,
    eventPayload,
    sourceRevisionId = null,
    reviewPacketId = null,
    proposalId = null,
    occurredAt = null,
    supabaseClient = defaultSupabase
}) {
    const { data, error } = await supabaseClient.rpc('append_owner_local_note_event', {
        p_user_id: requiredText(userId, 'userId'),
        p_manifest_id: requiredText(manifestId, 'manifestId'),
        p_event_type: requiredText(eventType, 'eventType'),
        p_event_status: requiredText(eventStatus, 'eventStatus'),
        p_actor_kind: requiredText(actorKind, 'actorKind'),
        p_actor_id: optionalText(actorId, 'actorId'),
        p_event_payload: objectPayload(eventPayload),
        p_source_revision_id: optionalText(sourceRevisionId, 'sourceRevisionId'),
        p_review_packet_id: optionalText(reviewPacketId, 'reviewPacketId'),
        p_proposal_id: optionalText(proposalId, 'proposalId'),
        p_occurred_at: optionalText(occurredAt, 'occurredAt')
    }).single();
    if (error) throw new Error(`Local note event append failed: ${error.message}`);
    return data;
}
