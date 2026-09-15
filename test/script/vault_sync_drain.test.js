import assert from 'node:assert/strict';
import test from 'node:test';

import { drainVaultSync } from '../../scripts/agent-sdk/drain-vault-sync.js';

test('drain isolates failures and reports persisted workflow ids', async () => {
  const queue = [{ id: 'bad' }, { id: 'good' }];
  const result = await drainVaultSync({
    agentIdentity: 'hermes:test',
    maxItems: 5,
    claimWorkflow: async () => queue.shift() || null,
    syncWorkflow: async (id) => {
      if (id === 'bad') throw new Error('Vault is unavailable');
      return { workflow_id: id, stage: 'complete', status: 'completed' };
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.processed, 1);
  assert.deepEqual(result.failed, [{ workflow_id: 'bad', status: 'failed', error: 'Vault is unavailable' }]);
  assert.deepEqual(result.succeeded, [{ workflow_id: 'good', stage: 'complete', status: 'completed' }]);
  assert.equal(result.stopped_when_empty, true);
});
