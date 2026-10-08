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
