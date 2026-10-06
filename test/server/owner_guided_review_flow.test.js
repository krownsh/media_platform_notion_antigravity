import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeTopicAssignment,
    buildPostLearningNotePayload,
    buildFolderProposalPayload
} from '../../server/services/reviewProposalService.js';

test('first review vertical keeps one folder, optional note, and bounded Topic assignment as candidates', () => {
    const folder = buildFolderProposalPayload({
        post: { content: '設計系統與 UI UX 的可用性檢查' },
        collections: [{ id: 'folder-ui', name: 'UI UX' }, { id: 'folder-code', name: '工程' }],
        sourceRevisionId: 'source-1'
    });
    assert.equal(folder.folder_id, 'folder-ui');
    assert.equal(folder.source_revision_id, 'source-1');

    assert.deepEqual(buildPostLearningNotePayload({ post: { content: '短連結' }, sourceRevisionId: 'source-1' }), {
        source_revision_id: 'source-1',
        note_status: 'not_needed',
        content: null,
        rationale: 'No durable learning note was inferred; Owner may record one instead.'
    });
    assert.equal(
        buildPostLearningNotePayload({ post: { content: '這是一段足夠長、需要 Owner 自己決定是否記錄的來源內容。'.repeat(4) }, sourceRevisionId: 'source-1' }).note_status,
        'needs_discussion'
    );

    assert.deepEqual(normalizeTopicAssignment({
        primary_topic: 'UI UX',
        related_topics: ['Design Systems', 'Accessibility', 'Accessibility']
    }), {
        primary_topic: 'UI UX',
        related_topics: ['Design Systems', 'Accessibility']
    });
});

test('topic assignment rejects more than two related Topics and a duplicated primary Topic', () => {
    assert.throws(
        () => normalizeTopicAssignment({ primary_topic: 'UI UX', related_topics: ['A', 'B', 'C'] }),
        /at most two/
    );
    assert.throws(
        () => normalizeTopicAssignment({ primary_topic: 'UI UX', related_topics: ['UI UX'] }),
        /must not repeat/
    );
});

test('promotion accepts only through the dedicated RPC and records edited values', async () => {
    let call;
    const client = {
        rpc(name, input) {
            call = { name, input };
            return { single: async () => ({ data: { id: 'packet-1', status: 'completed', version: 4 }, error: null }) };
        }
    };
    const { promoteReviewProposal } = await import('../../server/services/reviewPromotionService.js');
    const packet = await promoteReviewProposal({
        userId: 'user-1', packetId: 'packet-1', proposalId: 'proposal-1', action: 'edit_and_accept',
        expectedVersion: 3, editedPayload: { note_status: 'recorded', content: 'Owner note' }, supabaseClient: client
    });
    assert.equal(packet.status, 'completed');
    assert.deepEqual(call, {
        name: 'promote_owner_review_proposal',
        input: {
            p_user_id: 'user-1', p_packet_id: 'packet-1', p_proposal_id: 'proposal-1',
            p_action: 'edit_and_accept', p_expected_version: 3,
            p_edited_payload: { note_status: 'recorded', content: 'Owner note' }
        }
    });
});
