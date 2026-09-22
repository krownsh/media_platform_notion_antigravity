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
    collections: [{
      scope_role: 'primary',
      position: 0,
      collection: { id: 'collection-1', name: '工程師開發優化' }
    }],
    nodes: [{
      id: 'node-1',
      slug: 'spec-driven-development',
      node_type: 'workflow',
      title: 'Spec-driven development',
      problem: '如何在實作前讓需求與架構可審查？',
      content: { steps: ['釐清問題', '建立 spec', '審查後實作'] },
      status: 'active',
      evidence: [evidence]
    }],
    stages: [{
      id: 'stage-1',
      slug: 'problem-framing',
      title: '問題與需求假設',
      objective: '把市場訊號轉為可驗證的問題假設。',
      position: 0,
      required_inputs: ['市場訊號'],
      expected_outputs: ['問題假設'],
      gates: ['人類確認投入方向'],
      coverage_status: 'supported',
      status: 'active',
      node_links: [{ position: 0, node_id: 'node-1' }],
      transitions: [{ to_stage_id: 'stage-2', transition_type: 'progression', condition: '問題假設已明確' }]
    }, {
      id: 'stage-2',
      slug: 'post-release-review',
      title: '上線後訊號回收',
      objective: '以實際使用訊號回饋產品假設。',
      position: 1,
      required_inputs: ['上線資料'],
      expected_outputs: ['下一輪假設'],
      gates: ['尚待來源'],
      coverage_status: 'gap',
      status: 'active',
      node_links: [],
      transitions: [{ to_stage_id: 'stage-1', transition_type: 'feedback', condition: '發現假設失效或新訊號' }]
    }]
  });

  const result = await loadKnowledgeSpace({ spaceId: 'space-1', userId: 'owner-a', supabaseClient });

  assert.equal(result.readOnly, true);
  assert.equal(result.space.slug, 'zero-to-one-product-development');
  assert.deepEqual(result.collections, [{ id: 'collection-1', name: '工程師開發優化', role: 'primary', position: 0 }]);
  assert.equal(result.nodes[0].type, 'workflow');
  assert.deepEqual(result.nodes[0].content.steps, ['釐清問題', '建立 spec', '審查後實作']);
  assert.equal(result.nodes[0].evidence[0].postId, 'post-1');
  assert.equal(result.nodes[0].evidence[0].sourceUrl, 'https://example.test/openspec');
  assert.deepEqual(result.stages, [{
    id: 'stage-1',
    slug: 'problem-framing',
    title: '問題與需求假設',
    objective: '把市場訊號轉為可驗證的問題假設。',
    position: 0,
    requiredInputs: ['市場訊號'],
    expectedOutputs: ['問題假設'],
    gates: ['人類確認投入方向'],
    coverageStatus: 'gap',
    status: 'active',
    evidenceLinks: [],
    proposedEvidenceLinks: [],
    candidateNodes: [result.nodes[0]],
    transitions: [{ toStageId: 'stage-2', type: 'progression', condition: '問題假設已明確' }]
  }, {
    id: 'stage-2',
    slug: 'post-release-review',
    title: '上線後訊號回收',
    objective: '以實際使用訊號回饋產品假設。',
    position: 1,
    requiredInputs: ['上線資料'],
    expectedOutputs: ['下一輪假設'],
    gates: ['尚待來源'],
    coverageStatus: 'gap',
    status: 'active',
    evidenceLinks: [],
    proposedEvidenceLinks: [],
    candidateNodes: [],
    transitions: [{ toStageId: 'stage-1', type: 'feedback', condition: '發現假設失效或新訊號' }]
  }]);
  assert.deepEqual(supabaseClient.calls.slice(0, 4), [
    ['from', 'knowledge_spaces'],
    ['select', 'id, slug, name, purpose, status, taxonomy_version, collections:knowledge_space_collections!inner(scope_role, position, collection:collection_collections!inner(id, name)), nodes:knowledge_map_nodes!inner(id, slug, node_type, title, problem, content, status, evidence:knowledge_node_evidence!inner(source_post_id, evidence_role, excerpt, evidence_status, note, source_post:collection_posts!inner(title, original_url))), stages:knowledge_space_path_stages!left(id, slug, title, objective, position, required_inputs, expected_outputs, gates, coverage_status, status, node_links:knowledge_space_stage_nodes!left(position, node_id), evidence_links:knowledge_space_stage_evidence_links!left(id, position, node_id, evidence_role, rationale, applicability, limitation, status), transitions:knowledge_space_stage_transitions!knowledge_space_stage_transitions_from_stage_id_fkey(to_stage_id, transition_type, condition))'],
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

test('knowledge space reader distinguishes accepted workflow evidence from proposed and legacy candidate links', async () => {
  const supabaseClient = databaseReturning({
    id: 'space-1', slug: 'zero-to-one-product-development', name: '從 0 到 1 產品開發工作流', purpose: '', status: 'active', taxonomy_version: 1,
    collections: [{ scope_role: 'primary', position: 0, collection: { id: 'collection-1', name: '工程師開發優化' } }],
    nodes: [{ id: 'node-1', slug: 'spec-driven-development', node_type: 'workflow', title: 'Spec-driven development', problem: '如何在實作前讓需求與架構可審查？', content: {}, status: 'active', evidence: [evidence] }],
    stages: [{
      id: 'stage-1', slug: 'product-contract', title: '產品契約', objective: '把切片寫成可驗收的行為。', position: 0,
      required_inputs: [], expected_outputs: [], gates: [], coverage_status: 'supported', status: 'active',
      node_links: [{ position: 1, node_id: 'node-1' }],
      evidence_links: [
        { id: 'link-accepted', position: 0, node_id: 'node-1', evidence_role: 'method', rationale: '此方法能讓規格先被審查。', applicability: '需求尚未實作時', limitation: '不替代使用者驗收', status: 'accepted' },
        { id: 'link-proposed', position: 2, node_id: 'node-1', evidence_role: 'example', rationale: '待確認是否適用。', applicability: '', limitation: '', status: 'proposed' }
      ],
      transitions: []
    }]
  });

  const result = await loadKnowledgeSpace({ spaceId: 'space-1', userId: 'owner-a', supabaseClient });
  const stage = result.stages[0];

  assert.equal(stage.coverageStatus, 'supported');
  assert.deepEqual(stage.evidenceLinks, [{
    id: 'link-accepted', role: 'method', rationale: '此方法能讓規格先被審查。', applicability: '需求尚未實作時', limitation: '不替代使用者驗收', position: 0, status: 'accepted', node: result.nodes[0]
  }]);
  assert.deepEqual(stage.proposedEvidenceLinks, [{
    id: 'link-proposed', role: 'example', rationale: '待確認是否適用。', applicability: '', limitation: '', position: 2, status: 'proposed', node: result.nodes[0]
  }]);
  assert.deepEqual(stage.candidateNodes, [result.nodes[0]]);
  assert.match(supabaseClient.calls[1][1], /evidence_links:knowledge_space_stage_evidence_links!left\(id, position, node_id, evidence_role, rationale, applicability, limitation, status\)/);
});
