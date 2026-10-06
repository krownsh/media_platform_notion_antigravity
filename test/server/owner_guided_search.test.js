import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

import { buildOwnerSearchDocument, searchOwnerPostDocuments } from '../../server/services/ownerSearchService.js';
import { createSearchRouter } from '../../server/routes/searchRoutes.js';

const post = {
    id: '11111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222',
    title: '照片開口說話', author_name: '作者', platform: 'threads', original_url: 'https://example.test/post',
    content: '用一張照片和音訊生成 talking avatar。'
};

test('owner-guided document separates raw evidence, accepted knowledge, and pending candidates', () => {
    const document = buildOwnerSearchDocument({
        post, sourceRevision: { id: 'source-1', capture_quality: 'complete', source_payload: { comments: [{ content: '原始留言' }] } },
        learningNote: { note_status: 'recorded', content: '已確認：先測試口型同步。' },
        topicLinks: [{ owner_topics: { label: 'UI UX' } }],
        topicRevisions: [{ owner_topics: { label: 'UI UX' }, summary: '互動回饋的重點', claims: ['要有明確狀態'], open_questions: [] }],
        projectReferences: [{ owner_topics: { label: 'UI UX' }, owner_project_catalog: { title: '產品改版', description: '前端', reference: 'repo:product' }, rationale: '可以參考' }],
        proposals: [{ proposal_type: 'topic_knowledge_delta', status: 'pending', payload: { topics: [{ label: '候選 Topic', summary: '尚未確認' }] } }]
    });
    assert.match(document.raw_text, /talking avatar/);
    assert.match(document.raw_text, /原始留言/);
    assert.match(document.formal_text, /先測試口型同步/);
    assert.match(document.formal_text, /產品改版/);
    assert.match(document.candidate_text, /候選 Topic/);
    assert.deepEqual(document.formal_reasons, ['post_learning_note', 'topic_assignment', 'topic_knowledge', 'project_reference']);
    assert.deepEqual(document.candidate_reasons, ['candidate_topic_knowledge']);
});

test('owner-guided search RPC is tenant-scoped and candidates are opt-in', async () => {
    let args;
    const results = await searchOwnerPostDocuments({
        userId: post.user_id, query: '照片', limit: 200, includeCandidates: true,
        supabaseClient: { rpc(name, input) { assert.equal(name, 'search_owner_post_documents'); args = input; return Promise.resolve({ data: [{ post_id: post.id }], error: null }); } }
    });
    assert.equal(args.p_user_id, post.user_id);
    assert.equal(args.p_include_candidates, true);
    assert.equal(args.p_limit, 100);
    assert.deepEqual(results, [{ post_id: post.id }]);
});

test('search HTTP route exposes candidate inclusion only when explicitly requested', async () => {
    const calls = [];
    const app = express();
    app.use((req, _res, next) => { req.auth = { userId: post.user_id }; next(); });
    app.use('/api/search', createSearchRouter({ search: async input => { calls.push(input); return []; } }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/search?q=%E7%85%A7%E7%89%87&includeCandidates=true`);
        assert.equal(response.status, 200);
    } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    assert.deepEqual(calls, [{ userId: post.user_id, query: '照片', limit: undefined, includeCandidates: true }]);
});
