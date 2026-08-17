import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPostSearchDocument, searchPostDocuments } from '../../server/services/postSearchService.js';

const post = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  title: '照片開口說話',
  author_name: '作者',
  platform: 'threads',
  original_url: 'https://example.com/post',
  content: '用一張照片和音訊生成 talking avatar。',
  collection_post_analysis: [{ summary: 'AI 影片工具', tags: ['AI影片'], topics: ['影片'] }]
};

test('search documents keep lexical memory cues and draft text without vectors', () => {
  const document = buildPostSearchDocument(post, {
    generated: {
      keywords: ['AI 影片'],
      entities: ['LongCat-Video'],
      aliases: ['talking photo'],
      memory_cues: ['那個讓照片開口說話的工具']
    },
    contentDraft: '短影片草稿'
  });
  assert.deepEqual(document.memory_cues, ['那個讓照片開口說話的工具']);
  assert.match(document.search_text, /短影片草稿/);
  assert.equal('search_vector' in document, false);
});

test('search service passes tenant and filters to the service RPC', async () => {
  let args;
  const results = await searchPostDocuments({
    userId: post.user_id,
    query: '照片',
    limit: 20,
    workflowStatus: 'completed',
    supabaseClient: {
      rpc(name, rpcArgs) {
        assert.equal(name, 'search_collection_post_documents');
        args = rpcArgs;
        return Promise.resolve({ data: [{ post_id: post.id }], error: null });
      }
    }
  });
  assert.equal(args.p_user_id, post.user_id);
  assert.equal(args.p_workflow_status, 'completed');
  assert.deepEqual(results, [{ post_id: post.id }]);
});
