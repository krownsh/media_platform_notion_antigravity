import test from 'node:test';
import assert from 'node:assert/strict';
import {
    deriveNextAction,
    deferReviewPacket,
    resumeReviewPacket,
    decideReviewProposal,
    createReviewProposal
} from '../../server/services/reviewPacketService.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

test('next action is deterministic, explains a partial source, and never depends on a legacy workflow', () => {
    assert.deepEqual(deriveNextAction({
        id: 'packet-1',
        status: 'open',
        source_revision: { capture_quality: 'partial' },
        proposals: []
    }), {
        kind: 'repair_source',
        packet_id: 'packet-1',
        reason: 'source_is_partial'
    });

    assert.deepEqual(deriveNextAction({
        id: 'packet-2',
        status: 'open',
        source_revision: { capture_quality: 'complete' },
        proposals: [{ id: 'proposal-1', status: 'proposed', proposal_type: 'folder' }]
    }), {
        kind: 'review_proposal',
        packet_id: 'packet-2',
        proposal_id: 'proposal-1',
        proposal_type: 'folder',
        reason: 'owner_decision_required'
    });

    assert.deepEqual(deriveNextAction({ id: 'packet-3', status: 'deferred', proposals: [] }), {
        kind: 'resume_deferred',
        packet_id: 'packet-3',
        reason: 'owner_deferred'
    });
});

test('review mutations use owner-scoped transactional RPCs with optimistic versions', async () => {
    const calls = [];
    const client = {
        rpc(name, input) {
            calls.push({ name, input });
            return { single: async () => ({ data: { id: 'packet-1', version: 3 }, error: null }) };
        }
    };

    await deferReviewPacket({
        userId: USER_ID,
        packetId: 'packet-1',
        expectedVersion: 2,
        reason: 'Need time to compare',
        supabaseClient: client
    });
    await decideReviewProposal({
        userId: USER_ID,
        packetId: 'packet-1',
        proposalId: 'proposal-1',
        action: 'edit_and_accept',
        expectedVersion: 3,
        editedPayload: { title: 'Owner wording' },
        supabaseClient: client
    });
    await resumeReviewPacket({
        userId: USER_ID,
        packetId: 'packet-1',
        expectedVersion: 4,
        supabaseClient: client
    });

    assert.deepEqual(calls, [
        {
            name: 'defer_owner_review_packet',
            input: {
                p_user_id: USER_ID,
                p_packet_id: 'packet-1',
                p_expected_version: 2,
                p_reason: 'Need time to compare',
                p_deferred_until: null
            }
        },
        {
            name: 'transition_owner_review_proposal',
            input: {
                p_user_id: USER_ID,
                p_packet_id: 'packet-1',
                p_proposal_id: 'proposal-1',
                p_action: 'edit_and_accept',
                p_expected_version: 3,
                p_edited_payload: { title: 'Owner wording' }
            }
        },
        {
            name: 'resume_owner_review_packet',
            input: {
                p_user_id: USER_ID,
                p_packet_id: 'packet-1',
                p_expected_version: 4
            }
        }
    ]);
});

test('proposal creation carries a stable owner idempotency key and cannot introduce formal writes', async () => {
    let call;
    const client = {
        rpc(name, input) {
            call = { name, input };
            return { single: async () => ({ data: { id: 'proposal-1', status: 'proposed' }, error: null }) };
        }
    };

    const proposal = await createReviewProposal({
        userId: USER_ID,
        packetId: 'packet-1',
        proposalType: 'folder',
        payload: { suggested_folder: 'UI UX' },
        idempotencyKey: 'proposal-folder-1',
        supabaseClient: client
    });

    assert.equal(proposal.status, 'proposed');
    assert.equal(call.name, 'create_owner_review_proposal');
    assert.equal(call.input.p_idempotency_key, 'proposal-folder-1');
    assert.equal(Object.hasOwn(call.input, 'p_formal_record'), false);
});
