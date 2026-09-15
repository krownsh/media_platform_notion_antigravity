import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTopicKnowledgeAggregate } from '../../server/services/topicKnowledgeAggregateService.js';

test('aggregate uses only accepted evidence, deduplicates concepts, and preserves source traceability', () => {
    const aggregate = buildTopicKnowledgeAggregate({
        matches: [
            { status: 'accepted', source_id: 'b', matched_terms: ['AI', 'agents', 'AI'] },
            { status: 'suggested', source_id: 'ignored', matched_terms: ['should-not-appear'] },
            { status: 'accepted', source_id: 'a', matched_terms: ['agents', 'workflow'] }
        ],
        sources: [
            { id: 'a', title: 'Workflow design', original_url: 'https://a.test' },
            { id: 'b', title: 'Agent design', original_url: 'https://b.test' }
        ]
    });

    assert.deepEqual(aggregate.knowledge_source_ids, ['a', 'b']);
    assert.equal(aggregate.knowledge_source_count, 2);
    assert.deepEqual(aggregate.knowledge_concepts, ['AI', 'agents', 'workflow']);
    assert.deepEqual(aggregate.knowledge_open_questions, []);
    assert.match(aggregate.knowledge_summary, /已接受 2 個來源/);
    assert.match(aggregate.knowledge_summary, /Workflow design/);
    assert.match(aggregate.knowledge_summary, /Agent design/);
});

test('aggregate produces empty controlled defaults with no accepted sources', () => {
    const aggregate = buildTopicKnowledgeAggregate({ matches: [], sources: [] });

    assert.deepEqual(aggregate, {
        knowledge_summary: '',
        knowledge_concepts: [],
        knowledge_open_questions: [],
        knowledge_source_ids: [],
        knowledge_source_count: 0
    });
});
