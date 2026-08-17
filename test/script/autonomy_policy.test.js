import assert from 'node:assert/strict';
import test from 'node:test';

import {
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

test('low-confidence folder falls back to 待整理 and does not invent a folder', () => {
    const result = normalizePreprocessInput({
        outcome: 'complete',
        confidence: { content: 0.96, folder: 0.4 },
        risk_level: 'low',
        folder: { domain: '不確定資料夾', confidence: 0.4 }
    });
    assert.equal(result.autonomy.outcome, 'complete');
    assert.equal(result.folder.domain, '待整理');
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
