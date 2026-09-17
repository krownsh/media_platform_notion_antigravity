import assert from 'node:assert/strict';
import test from 'node:test';

import { loadKnowledgeSpace } from '../../server/services/knowledgeSpaceService.js';

function databaseReturning(data, error = null) {
  const calls = [];
  const query = {
    select(selection) { calls.push(['select', selection]); return query; },
    eq(column, value) { calls.push(['eq', column, value]); return query; },
    maybeSingle: async () => ({ data, error })
  };
  return { calls, from(table) { calls.push(['from', table]); return query; } };
}

const evidence = {
  source_post_id: 'post-1',
  evidence_role: 'workflow_step',
  excerpt: '先把需求與架構釐清，再把內容做成可審查的規格。',
  evidence_status: 'author_claim_unverified',
  note: '文章描述 OpenSpec 的前段流程。',
  source_post: { title: 'OpenSpec 工作流', original_url: 'https://example.test/openspec' }
};

test('knowledge space reader returns owner-scoped, evidence-cited technical nodes', async () => {
  const supabaseClient = databaseReturning({
    id: 'space-1',
    slug: 'zero-to-one-product-development',
    name: '從 0 到 1 產品開發工作流',
    purpose: '把產品構想推進到可驗證產品。',
    status: 'active',
    taxonomy_version: 1,
    nodes: [{
      id: 'node-1',
      slug: 'spec-driven-development',
      node_type: 'workflow',
      title: 'Spec-driven development',
      problem: '如何在實作前讓需求與架構可審查？',
      content: { steps: ['釐清問題', '建立 spec', '審查後實作'] },
      status: 'active',
      evidence: [evidence]
    }]
  });

  const result = await loadKnowledgeSpace({ spaceId: 'space-1', userId: 'owner-a', supabaseClient });

  assert.equal(result.readOnly, true);
  assert.equal(result.space.slug, 'zero-to-one-product-development');
  assert.equal(result.nodes[0].type, 'workflow');
  assert.deepEqual(result.nodes[0].content.steps, ['釐清問題', '建立 spec', '審查後實作']);
  assert.equal(result.nodes[0].evidence[0].postId, 'post-1');
  assert.equal(result.nodes[0].evidence[0].sourceUrl, 'https://example.test/openspec');
  assert.deepEqual(supabaseClient.calls.slice(0, 4), [
    ['from', 'knowledge_spaces'],
    ['select', 'id, slug, name, purpose, status, taxonomy_version, nodes:knowledge_map_nodes!inner(id, slug, node_type, title, problem, content, status, evidence:knowledge_node_evidence!inner(source_post_id, evidence_role, excerpt, evidence_status, note, source_post:collection_posts!inner(title, original_url)))'],
    ['eq', 'id', 'space-1'],
    ['eq', 'user_id', 'owner-a']
  ]);
});

test('knowledge space reader neither substitutes an absent space nor renders an uncited node', async () => {
  await assert.rejects(
    () => loadKnowledgeSpace({ spaceId: 'missing', userId: 'owner-a', supabaseClient: databaseReturning(null) }),
    { code: 'KNOWLEDGE_SPACE_NOT_FOUND' }
  );

  await assert.rejects(
    () => loadKnowledgeSpace({
      spaceId: 'space-1',
      userId: 'owner-a',
      supabaseClient: databaseReturning({ id: 'space-1', name: 'x', nodes: [{ id: 'node-1', evidence: [] }] })
    }),
    { code: 'KNOWLEDGE_SPACE_INVALID' }
  );
});
