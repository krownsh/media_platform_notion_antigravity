import { supabase as defaultSupabase } from '../supabaseClient.js';

const JOB_STATUSES = new Set(['pending', 'processing', 'completed', 'failed', 'rate_limited', 'waiting_source_repair']);

function required(value, name) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
    return value.trim();
}

/**
 * Creates the durable, owner-scoped handoff for an external reasoning run.
 * It deliberately has no proposal-generation logic: a job is a request for
 * analysis, never a semantic decision or a formal write.
 */
export async function ensureCandidateGenerationJob({
    userId,
    sourceRevisionId,
    reviewPacketId,
    captureQuality,
    supabaseClient = defaultSupabase
}) {
    required(userId, 'userId');
    required(sourceRevisionId, 'sourceRevisionId');
    required(reviewPacketId, 'reviewPacketId');
    if (!['complete', 'partial'].includes(captureQuality)) throw new Error('captureQuality must be complete or partial');

    const { data, error } = await supabaseClient.rpc('enqueue_owner_candidate_generation_job', {
        p_user_id: userId,
        p_source_revision_id: sourceRevisionId,
        p_review_packet_id: reviewPacketId,
        p_initial_status: captureQuality === 'complete' ? 'pending' : 'waiting_source_repair'
    }).single();
    if (error) throw new Error(`Candidate generation handoff failed: ${error.message}`);
    return data;
}

export async function listCandidateGenerationJobs({ userId, packetIds = [], supabaseClient = defaultSupabase }) {
    required(userId, 'userId');
    if (!packetIds.length) return [];
    const { data, error } = await supabaseClient
        .from('owner_candidate_generation_jobs')
        .select('id, review_packet_id, source_revision_id, status, attempts, available_at, last_error, completed_at, updated_at')
        .eq('user_id', userId)
        .in('review_packet_id', packetIds);
    if (error) throw new Error(`Candidate generation status lookup failed: ${error.message}`);
    return data || [];
}

export function candidateGenerationNextAction({ packet, job }) {
    if (packet?.source_revision?.capture_quality === 'partial') {
        return { kind: 'repair_source', packet_id: packet.id, reason: 'source_is_partial' };
    }
    if (!job) return { kind: 'awaiting_candidate_job', packet_id: packet?.id || null, reason: 'candidate_job_not_enqueued' };
    if (job.status === 'rate_limited') return { kind: 'candidate_generation_paused', packet_id: packet?.id || null, reason: 'rate_limited', available_at: job.available_at };
    if (job.status === 'pending' || job.status === 'processing') return { kind: 'candidate_generation_pending', packet_id: packet?.id || null, reason: job.status, available_at: job.available_at };
    if (job.status === 'failed') return { kind: 'candidate_generation_failed', packet_id: packet?.id || null, reason: 'retryable_failure' };
    if (job.status === 'completed') {
        const discussion = (packet?.checkpoints || []).find(item => item?.checkpoint_key === 'content_discussion');
        if (discussion?.status !== 'completed') return { kind: 'discuss_source_with_agent', packet_id: packet?.id || null, reason: 'content_discussion_required' };
    }
    return null;
}

export { JOB_STATUSES };
