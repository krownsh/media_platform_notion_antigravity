import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { loadKnowledgeMap } from '../../server/services/knowledgeMapService.js';

function databaseReturning(data, error = null) {
  const calls = [];
  const query = {
    select(selection) {
      calls.push(['select', selection]);
      return query;
    },
    eq(column, value) {
      calls.push(['eq', column, value]);
      return query;
    },
    maybeSingle: async () => ({ data, error })
  };

  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return query;
    }
  };
}

test('knowledge map reads one user-owned collection projection from Supabase and preserves inline citations', async () => {
  const supabaseClient = databaseReturning({
    collection_id: 'collection-a',
    status: 'partial',
    question: 'AI agent 怎麼能交接？',
    caveat: '僅代表已處理貼文。',
    processed_posts: 75,
    total_posts: 429,
    statements: [{
      text: '先定義驗收，再叫 AI 動手。',
      detail: '把不可碰範圍寫清楚。',
      citations: [{
        post_id: 'post-1',
        title: '先說完整需求，再交給 plan mode',
        excerpt: '作者建議先完整說明想做的事，再交給 plan mode。',
        evidence_status: 'author_claim_unverified'
      }]
    }],
    collection: { name: 'agent工具' }
  });

  const result = await loadKnowledgeMap({
    collectionId: 'collection-a',
    userId: 'owner-a',
    supabaseClient
  });

  assert.equal(result.readOnly, true);
  assert.equal(result.collection.id, 'collection-a');
  assert.equal(result.collection.name, 'agent工具');
  assert.equal(result.collection.statements[0].citations[0].postId, 'post-1');
  assert.equal(result.progress.processedPosts, 75);
  assert.equal(result.progress.totalPosts, 429);
  assert.deepEqual(supabaseClient.calls.slice(0, 4), [
    ['from', 'collection_knowledge_maps'],
    ['select', 'collection_id, status, question, caveat, statements, processed_posts, total_posts, collection:collection_collections!inner(name)'],
    ['eq', 'collection_id', 'collection-a'],
    ['eq', 'user_id', 'owner-a']
  ]);
});

test('knowledge map does not substitute another collection and has no local artifact reader', async () => {
  const supabaseClient = databaseReturning(null);

  await assert.rejects(
    () => loadKnowledgeMap({ collectionId: 'missing', userId: 'owner-a', supabaseClient }),
    { code: 'KNOWLEDGE_MAP_NOT_FOUND' }
  );

  const service = fs.readFileSync('server/services/knowledgeMapService.js', 'utf8');
  assert.doesNotMatch(service, /readFile|KNOWLEDGE_MAP_RUN_DIR|DEFAULT_KNOWLEDGE_MAP_RUN_DIR/);
});
