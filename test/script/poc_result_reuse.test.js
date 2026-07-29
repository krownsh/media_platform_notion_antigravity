import assert from 'node:assert/strict';
import test from 'node:test';
import { getSuccessfulPoc } from '../../scripts/agent-sdk/analyze-item.js';

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
