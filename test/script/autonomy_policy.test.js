import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildAutomationContext,
    normalizeAutonomyDecision,
    normalizePreprocessInput
} from '../../server/services/autonomyPolicyService.js';

test('high-confidence low-risk preprocessing stays autonomous', () => {
    const decision = normalizeAutonomyDecision({
        outcome: 'complete',
        confidence: { content: 0.96, topic: 0.91, folder: 0.9 },
        risk_level: 'low'
    });
    assert.equal(decision.outcome, 'complete');
    assert.equal(decision.network_required, false);
});

test('a network POC candidate is recorded without blocking preprocessing', () => {
    const decision = normalizeAutonomyDecision({
        outcome: 'complete',
        confidence: { content: 0.99, poc: 0.98 },
        risk_level: 'low',
        poc: { network_required: true }
    });
    assert.equal(decision.outcome, 'complete');
    assert.equal(decision.reason, null);
    assert.equal(decision.network_required, true);
    assert.equal(decision.poc_execution_requested, false);
});

test('an explicitly requested secret-requiring POC is treated as high risk', () => {
    const decision = normalizeAutonomyDecision({
        outcome: 'complete',
        confidence: { content: 0.99, poc: 0.98 },
        risk_level: 'low',
        poc: { secrets_required: true, auto_execute: true }
    });
    assert.equal(decision.outcome, 'review_pending');
    assert.equal(decision.secrets_required, true);
    assert.equal(decision.poc_execution_requested, true);
});

test('low-confidence folder is preserved only as a suggestion and does not invent a folder', () => {
    const result = normalizePreprocessInput({
        outcome: 'complete',
        confidence: { content: 0.96, folder: 0.4 },
        risk_level: 'low',
        folder: { domain: '不確定資料夾', confidence: 0.4 }
    });
    assert.equal(result.autonomy.outcome, 'complete');
    assert.equal(result.folder.collection_id, null);
    assert.equal(result.folder.suggested_name, '不確定資料夾');
});

test('rejected container IDs retain classification suggestions for human review', () => {
    const result = normalizePreprocessInput({
        outcome: 'complete',
        confidence: { content: 0.96, topic: 0.91, folder: 0.9 },
        risk_level: 'low',
        topic: { topic_id: 'legacy-topic', title: 'Agent tools', confidence: 0.91 },
        folder: { collection_id: 'missing-collection', domain: 'Agent 工具', confidence: 0.9 }
    });
    const context = buildAutomationContext(result, {
        topic_persistence: { deferred: true, reason: 'topic_not_user_active', topic: null },
        folder_persistence: { assigned: false, reason: 'collection_not_found' }
    });
    assert.equal(context.classification_suggestions.topic.suggested_title, 'Agent tools');
    assert.equal(context.classification_suggestions.folder.suggested_name, 'Agent 工具');
});

test('review questions are persisted as data, not an interactive Cron prompt', () => {
    const result = normalizePreprocessInput({
        outcome: 'review_pending',
        confidence: { content: 0.93, intent: 0.5 },
        risk_level: 'low',
        review_request: { question: '是否允許下一步？', options: ['approve', 'skip'] }
    });
    assert.equal(result.autonomy.outcome, 'review_pending');
    assert.equal(result.review_request.question, '是否允許下一步？');
    assert.deepEqual(result.review_request.options, ['approve', 'skip']);
});
