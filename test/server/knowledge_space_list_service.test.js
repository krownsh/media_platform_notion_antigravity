import assert from 'node:assert/strict';
import test from 'node:test';

import { listKnowledgeSpaces } from '../../server/services/knowledgeSpaceService.js';

function databaseReturningMany(data, error = null) {
  const calls = [];
  const query = {
    select(selection) { calls.push(['select', selection]); return query; },
    eq(column, value) { calls.push(['eq', column, value]); return query; },
    in(column, values) { calls.push(['in', column, values]); return query; },
    order(column, options) { calls.push(['order', column, options]); return Promise.resolve({ data, error }); }
  };
  return { calls, from(table) { calls.push(['from', table]); return query; } };
}

test('knowledge-space index returns only the owner’s readable space summaries', async () => {
  const supabaseClient = databaseReturningMany([{
    id: 'space-1',
    slug: 'zero-to-one-product-development',
    name: '從 0 到 1 產品開發工作流',
    purpose: '把產品構想推進到可驗證產品。',
    status: 'active',
    taxonomy_version: 1
  }]);

  const result = await listKnowledgeSpaces({ userId: 'owner-a', supabaseClient });

  assert.deepEqual(result, {
    readOnly: true,
    spaces: [{
      id: 'space-1',
      slug: 'zero-to-one-product-development',
      name: '從 0 到 1 產品開發工作流',
      purpose: '把產品構想推進到可驗證產品。',
      status: 'active',
      taxonomyVersion: 1
    }]
  });
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'knowledge_spaces'],
    ['select', 'id, slug, name, purpose, status, taxonomy_version'],
    ['eq', 'user_id', 'owner-a'],
    ['in', 'status', ['active', 'published']],
    ['order', 'updated_at', { ascending: false }]
  ]);
});

test('knowledge-space index rejects unavailable database reads', async () => {
  await assert.rejects(
    () => listKnowledgeSpaces({ userId: 'owner-a', supabaseClient: databaseReturningMany(null, { message: 'timeout' }) }),
    { code: 'KNOWLEDGE_SPACE_UNAVAILABLE' }
  );
});
