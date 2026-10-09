import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createLocalMediaKnowledgeRouter } from '../../server/routes/localMediaKnowledgeRoutes.js';

test('local record status route uses the authenticated owner and returns one visible next action', async () => {
    const calls = [];
    const app = express();
    app.use((req, _res, next) => { req.auth = { userId: 'user-1' }; next(); });
    app.use('/api/local-records', createLocalMediaKnowledgeRouter({
        loadPost: async input => {
            calls.push(input);
            return { sourceRevision: { id: 'source-1' } };
        },
        loadManifest: async input => {
            calls.push(input);
            return null;
        }
    }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/local-records/posts/post-1`);
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.local_record.phase, 'ready_to_create');
        assert.equal(payload.local_record.next_action.type, 'create_local_record');
    } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    assert.deepEqual(calls, [
        { userId: 'user-1', postId: 'post-1' },
        { userId: 'user-1', postId: 'post-1' }
    ]);
});
