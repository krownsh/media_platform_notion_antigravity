import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contractPath = new URL('../../docs/architecture/owner-guided-workflow-contract.md', import.meta.url);
const inventoryPath = new URL('../../docs/architecture/legacy-retirement-inventory.md', import.meta.url);
const ledgerPath = new URL('../../docs/architecture/owner-guided-workflow-evidence-ledger.md', import.meta.url);

test('owner-guided workflow contract makes source, proposal, and accepted state distinct', async () => {
  const contract = await readFile(contractPath, 'utf8');

  for (const requirement of [
    'Supabase is the only authoritative store',
    'Capture persists source facts only',
    'proposal-first',
    'accepted-only',
    'zero or one accepted primary folder',
    'one primary Topic and up to two related Topics',
    'not_needed',
    'next_action',
    'partial',
    'failed'
  ]) {
    assert.match(contract, new RegExp(requirement, 'i'), `missing contract requirement: ${requirement}`);
  }
});

test('legacy retirement inventory distinguishes freeze, hide, and physical removal', async () => {
  const inventory = await readFile(inventoryPath, 'utf8');

  for (const requirement of [
    'Knowledge Space',
    'collection_post_workflows',
    'collection_capture_outbox',
    'Vault',
    'Freeze',
    'Hide',
    'Remove',
    'backup',
    'owner confirmation'
  ]) {
    assert.match(inventory, new RegExp(requirement, 'i'), `missing retirement requirement: ${requirement}`);
  }
});

test('evidence ledger keeps milestone proof and limits explicit', async () => {
  const ledger = await readFile(ledgerPath, 'utf8');

  for (const requirement of [
    'M0',
    'M1',
    'M2',
    'Known limits',
    'Rollback',
    'isolated PostgreSQL',
    'authenticated browser'
  ]) {
    assert.match(ledger, new RegExp(requirement, 'i'), `missing ledger requirement: ${requirement}`);
  }
});
