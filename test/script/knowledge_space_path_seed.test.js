import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const seedPath = new URL('../../database/deployments/stage_w4_knowledge_space_path_seed.sql', import.meta.url);

test('initial knowledge-space path seed is owner-derived, idempotent, evidence-honest, and has a feedback edge', async () => {
  const sql = await readFile(seedPath, 'utf8');

  assert.match(sql, /where id = '006ae3e5-a6e7-4334-b6fc-befd5c80dc9b'/i);
  assert.match(sql, /select id, user_id\s+from public\.knowledge_spaces/i);
  assert.match(sql, /on conflict \(space_id, slug\) do update/i);
  assert.match(sql, /on conflict \(stage_id, node_id\) do update/i);
  assert.match(sql, /on conflict \(from_stage_id, to_stage_id, transition_type\) do update/i);
  for (const slug of ['market-signal', 'hypothesis', 'preflight', 'product-contract', 'engineering-verification', 'release-readiness', 'post-release-review']) {
    assert.match(sql, new RegExp(`'${slug}'`, 'i'));
  }
  assert.match(sql, /'hypothesis'[\s\S]{0,700}'gap'/i);
  assert.match(sql, /'release-readiness'[\s\S]{0,700}'gap'/i);
  assert.match(sql, /'post-release-review'[\s\S]{0,700}'gap'/i);
  assert.match(sql, /'post-release-review', 'market-signal', 'feedback'/i);
  for (const nodeId of [
    '5b8cad14-6325-4e2a-b0ad-260904b00de1',
    '9d5b1eb7-c04d-4c95-b7ef-79632482650a',
    '33c7822d-f0ff-46d7-88b5-967fca59ff5e',
    '7192dbab-00ad-4ed0-aa0a-6faa09c059d4',
    'eecca1fd-e7ba-4f1c-8088-8ac80a112900',
    'a3cb539b-bd05-45d1-95c7-b230a3312bdd'
  ]) assert.match(sql, new RegExp(nodeId, 'i'));
  assert.doesNotMatch(sql, /\b(delete\s+from|truncate|drop\s+table)\b/i);
});
