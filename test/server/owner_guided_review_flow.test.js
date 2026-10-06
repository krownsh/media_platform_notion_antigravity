import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeTopicAssignment,
    buildPostLearningNotePayload,
    buildFolderProposalPayload,
    buildTopicKnowledgeProposalPayload,
    buildProjectReferenceProposalPayloads,
    prepareInitialReviewProposals
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

test('Topic knowledge and Project candidates remain drafts and do not require a repository to create a Topic', () => {
    const topicPayload = { primary_topic: 'UI UX', related_topics: ['Accessibility'] };
    const topicDelta = buildTopicKnowledgeProposalPayload({
        topicPayload,
        post: { content: '這是一則足夠長的來源，值得由 Owner 決定是否把它寫成主題知識摘要。'.repeat(4) },
        sourceRevisionId: 'source-1'
    });
    assert.equal(topicDelta.decision, 'needs_discussion');
    assert.deepEqual(topicDelta.topics.map(item => item.label), ['UI UX', 'Accessibility']);

    const references = buildProjectReferenceProposalPayloads({
        topicPayload,
        post: { title: 'UI UX accessibility audit', content: 'design review' },
        sourceRevisionId: 'source-1',
        projects: [
            { id: 'project-ui', title: 'UI UX product refresh', description: 'Accessibility work', reference: 'local:/projects/ui' },
            { id: 'project-data', title: 'Data pipeline', description: 'ETL', reference: 'https://example.test/data' }
        ]
    });
    assert.deepEqual(references.map(item => item.project_id), ['project-ui']);
    assert.equal(references[0].topic_labels[0], 'UI UX');
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

test('a partial source creates a repair packet before any semantic candidate exists', async () => {
    const tablesRead = [];
    const client = {
        rpc(name) {
            assert.equal(name, 'ensure_owner_review_packet');
            return { single: async () => ({ data: { id: 'packet-partial', source_revision_id: 'source-partial' }, error: null }) };
        },
        from(table) {
            tablesRead.push(table);
            if (table !== 'collection_source_revisions') {
                throw new Error(`partial source must not read candidate input from ${table}`);
            }
            const query = {
                select() { return query; },
                eq() { return query; },
                maybeSingle: async () => ({
                    data: {
                        id: 'source-partial',
                        post_id: 'post-partial',
                        capture_quality: 'partial',
                        collection_posts: { id: 'post-partial', title: 'Partial source', content: 'Only a link was saved.' }
                    },
                    error: null
                })
            };
            return query;
        }
    };

    const review = await prepareInitialReviewProposals({
        userId: 'user-partial', sourceRevisionId: 'source-partial', supabaseClient: client
    });

    assert.equal(review.packet.id, 'packet-partial');
    assert.deepEqual(review.proposals, []);
    assert.deepEqual(tablesRead, ['collection_source_revisions']);
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

test('Topic knowledge promotion falls through to the dedicated M4 transaction only', async () => {
    const calls = [];
    const client = {
        rpc(name, input) {
            calls.push({ name, input });
            const error = name === 'promote_owner_review_proposal'
                ? { message: 'REVIEW_PROMOTION_TYPE_UNSUPPORTED', code: 'P0001' }
                : null;
            return { single: async () => ({ data: error ? null : { id: 'packet-1', status: 'open', version: 5 }, error }) };
        }
    };
    const { promoteReviewProposal } = await import('../../server/services/reviewPromotionService.js');
    const packet = await promoteReviewProposal({
        userId: 'user-1', packetId: 'packet-1', proposalId: 'proposal-topic', action: 'accept', expectedVersion: 4, supabaseClient: client
    });
    assert.equal(packet.version, 5);
    assert.deepEqual(calls.map(call => call.name), ['promote_owner_review_proposal', 'promote_owner_knowledge_proposal']);
});

test('a successful owner promotion asks the rebuildable search projection to refresh', async () => {
    const indexed = [];
    const client = {
        rpc() {
            return { single: async () => ({ data: { id: 'packet-1', status: 'open', version: 2, post_id: 'post-1', source_revision_id: 'source-1' }, error: null }) };
        }
    };
    const { promoteReviewProposal } = await import('../../server/services/reviewPromotionService.js');
    await promoteReviewProposal({
        userId: 'user-1', packetId: 'packet-1', proposalId: 'proposal-1', action: 'accept', expectedVersion: 1,
        supabaseClient: client, searchIndexer: async input => indexed.push(input)
    });
    assert.deepEqual(indexed, [{ userId: 'user-1', postId: 'post-1', sourceRevisionId: 'source-1', supabaseClient: client }]);
});
