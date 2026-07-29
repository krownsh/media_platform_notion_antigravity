import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTopicScopeToClassification,
  getSuccessfulPoc
} from '../../scripts/agent-sdk/analyze-item.js';

test('getSuccessfulPoc finds a prior successful run before proposal state is changed', () => {
  const result = getSuccessfulPoc({
    collection_post_analysis: {
      insights: [
        { type: 'poc_run', status: 'failed', run_id: 'failed-run' },
        { type: 'poc_run', status: 'success', run_id: 'success-run' }
      ]
    }
  });

  assert.equal(result.run_id, 'success-run');
});

test('getSuccessfulPoc handles missing analysis safely', () => {
  assert.equal(getSuccessfulPoc({}), null);
});

test('research scope adds a proposal route without executing research', () => {
  const result = applyTopicScopeToClassification({
    primary_intent: 'quick_rewrite',
    urgency: 'normal',
    routes: [{ type: 'quick_rewrite', priority: 60, reason: 'draft' }],
    reasons: []
  }, { hasResearchScope: true });

  assert.equal(result.routes[0].type, 'research_content');
  assert.equal(result.routes[0].priority, 80);
  assert.equal(result.routes.some(route => route.type === 'quick_rewrite'), true);
});
