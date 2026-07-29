import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPocDuration, getLatestSuccessfulPocResult } from '../../src/utils/pocResults.js';

test('selects the latest successful POC result and ignores failed attempts', () => {
  const result = getLatestSuccessfulPocResult([
    { type: 'poc_run', status: 'error', run_id: 'failed' },
    { type: 'poc_run', status: 'success', run_id: 'first-success' },
    { type: 'other', status: 'success' },
    { type: 'poc_run', status: 'success', run_id: 'latest-success' }
  ]);

  assert.equal(result.run_id, 'latest-success');
});

test('returns null for missing POC results and formats execution duration', () => {
  assert.equal(getLatestSuccessfulPocResult(null), null);
  assert.equal(getLatestSuccessfulPocResult([{ type: 'poc_run', status: 'error' }]), null);
  assert.equal(formatPocDuration(9041), '9.04 秒');
  assert.equal(formatPocDuration(null), '未提供');
  assert.equal(formatPocDuration(-1), '未提供');
});
