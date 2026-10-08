import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createOwnerLibraryRouter } from '../../server/routes/ownerLibraryRoutes.js';

test('owner Library detail is user-scoped and keeps accepted and candidate information distinct', async () => {
    const app = express();
    const calls = [];
    app.use(express.json());
    app.use((req, _res, next) => { req.auth = { userId: 'user-1' }; next(); });
    app.use('/api/owner-library', createOwnerLibraryRouter({ loadPost: async input => {
        calls.push(input);
        return {
            post: { id: 'post-1', title: 'Source' }, sourceRevision: { id: 'source-1', capture_quality: 'complete' },
            learningNote: { note_status: 'recorded', content: 'Accepted note' },
            topicLinks: [{ owner_topics: [{ label: 'UI UX' }] }], topicRevisions: [], projectReferences: [],
            proposals: [{ id: 'candidate-1', proposal_type: 'topic_knowledge_delta', status: 'pending' }, { id: 'old-1', proposal_type: 'topic_assignment', status: 'accepted' }]
        };
    } }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/owner-library/posts/post-1`);
        const payload = await response.json();
        assert.equal(response.status, 200);
        assert.equal(payload.learning_note.content, 'Accepted note');
        assert.equal(payload.topic_links[0].topic.label, 'UI UX');
        assert.deepEqual(payload.candidates.map(item => item.id), ['candidate-1']);
    } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    assert.deepEqual(calls, [{ userId: 'user-1', postId: 'post-1' }]);
});

test('owner Library organization routes keep folder creation and assignment in owner-scoped services', async () => {
    const app = express();
    const calls = [];
    app.use(express.json());
    app.use((req, _res, next) => { req.auth = { userId: 'user-1' }; next(); });
    app.use('/api/owner-library', createOwnerLibraryRouter({
        createFolder: async input => { calls.push(['create', input]); return { id: 'folder-1', name: input.name }; },
        setFolder: async input => { calls.push(['assign', input]); return { collection_id: input.collectionId, decision_path: 'review_promotion' }; }
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    try {
        const create = await fetch(`http://127.0.0.1:${server.address().port}/api/owner-library/folders`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'UI UX' })
        });
        assert.equal(create.status, 201);
        assert.equal((await create.json()).collection.name, 'UI UX');
        const assign = await fetch(`http://127.0.0.1:${server.address().port}/api/owner-library/posts/post-1/folder`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ collection_id: 'folder-1' })
        });
        assert.equal(assign.status, 200);
        assert.equal((await assign.json()).decision_path, 'review_promotion');
    } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    assert.deepEqual(calls, [
        ['create', { userId: 'user-1', name: 'UI UX' }],
        ['assign', { userId: 'user-1', postId: 'post-1', collectionId: 'folder-1' }]
    ]);
});
