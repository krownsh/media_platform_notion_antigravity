import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createOwnerLibraryRouter } from '../../server/routes/ownerLibraryRoutes.js';

test('owner Library detail is user-scoped and keeps accepted and candidate information distinct', async () => {
    const app = express();
    const calls = [];
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
