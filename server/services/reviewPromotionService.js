import { supabase as defaultSupabase } from '../supabaseClient.js';
import { deriveNextAction, loadReviewPacket } from './reviewPacketService.js';
import { refreshOwnerPostSearchDocument } from './ownerSearchService.js';

export async function promoteReviewProposal({
    userId, packetId, proposalId, action, expectedVersion, editedPayload = null, supabaseClient = defaultSupabase,
    searchIndexer = refreshOwnerPostSearchDocument
}) {
    if (!userId || !packetId || !proposalId) throw new Error('userId, packetId, and proposalId are required');
    if (!['accept', 'edit_and_accept'].includes(action)) throw new Error('action must be accept or edit_and_accept');
    const input = {
        p_user_id: userId,
        p_packet_id: packetId,
        p_proposal_id: proposalId,
        p_action: action,
        p_expected_version: expectedVersion,
        p_edited_payload: editedPayload
    };
    let { data, error } = await supabaseClient.rpc('promote_owner_review_proposal', input).single();
    if (error?.message?.includes('REVIEW_PROMOTION_TYPE_UNSUPPORTED')) {
        ({ data, error } = await supabaseClient.rpc('promote_owner_knowledge_proposal', input).single());
    }
    if (error) {
        const wrapped = new Error(`Review proposal promotion failed: ${error.message}`);
        wrapped.code = error.code;
        throw wrapped;
    }
    // Search is a rebuildable projection. A failed refresh must not undo a
    // transaction that already recorded the Owner's accepted decision.
    try {
        if (data?.post_id || data?.source_revision_id) {
            await searchIndexer({ userId, postId: data.post_id, sourceRevisionId: data.source_revision_id, supabaseClient });
        } else if (typeof supabaseClient.from === 'function') {
            const packet = await loadReviewPacket({ userId, packetId, supabaseClient });
            if (packet?.post_id) await searchIndexer({ userId, postId: packet.post_id, sourceRevisionId: packet.source_revision_id, supabaseClient });
        }
    } catch (indexError) {
        console.warn(`[Review] Search projection deferred: ${indexError.message}`);
    }
    if (typeof supabaseClient.from !== 'function') return { ...data, next_action: deriveNextAction(data) };
    try {
        return (await loadReviewPacket({ userId, packetId, supabaseClient })) || { ...data, next_action: deriveNextAction(data) };
    } catch {
        return { ...data, next_action: deriveNextAction(data) };
    }
}
