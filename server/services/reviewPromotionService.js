import { supabase as defaultSupabase } from '../supabaseClient.js';
import { deriveNextAction, loadReviewPacket } from './reviewPacketService.js';

export async function promoteReviewProposal({
    userId, packetId, proposalId, action, expectedVersion, editedPayload = null, supabaseClient = defaultSupabase
}) {
    if (!userId || !packetId || !proposalId) throw new Error('userId, packetId, and proposalId are required');
    if (!['accept', 'edit_and_accept'].includes(action)) throw new Error('action must be accept or edit_and_accept');
    const { data, error } = await supabaseClient.rpc('promote_owner_review_proposal', {
        p_user_id: userId,
        p_packet_id: packetId,
        p_proposal_id: proposalId,
        p_action: action,
        p_expected_version: expectedVersion,
        p_edited_payload: editedPayload
    }).single();
    if (error) {
        const wrapped = new Error(`Review proposal promotion failed: ${error.message}`);
        wrapped.code = error.code;
        throw wrapped;
    }
    if (typeof supabaseClient.from !== 'function') return { ...data, next_action: deriveNextAction(data) };
    try {
        return (await loadReviewPacket({ userId, packetId, supabaseClient })) || { ...data, next_action: deriveNextAction(data) };
    } catch {
        return { ...data, next_action: deriveNextAction(data) };
    }
}
