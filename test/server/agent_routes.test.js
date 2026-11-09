import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAgentRouter, requireAgentDraftApiKey } from '../../server/routes/agentRoutes.js';

const TEST_AGENT_KEY = 'agt_draft_test_secret_1234567890';

function mockSupabase(sampleDrafts = []) {
    return {
        from(tableName) {
            assert.equal(tableName, 'content_assets');
            return {
                select() {
                    return {
                        order() {
                            return {
                                limit(n) {
                                    return {
                                        eq(col, val) {
                                            const filtered = sampleDrafts.filter((d) => d[col] === val);
                                            return Promise.resolve({ data: filtered, error: null });
                                        },
                                        then(resolve) {
                                            resolve({ data: sampleDrafts.slice(0, n), error: null });
                                        }
                                    };
                                }
                            };
                        },
                        eq(col, val) {
                            return {
                                maybeSingle() {
                                    const found = sampleDrafts.find((d) => d[col] === val) || null;
                                    return Promise.resolve({ data: found, error: null });
                                }
                            };
                        }
                    };
                }
            };
        }
    };
}

const mockDraftAssets = [
    {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Draft Article 1',
        format: 'linkedin_post',
        status: 'draft',
        metadata: { source_url: 'https://example.com/1' },
        created_at: '2026-11-01T10:00:00Z',
        updated_at: '2026-11-01T10:00:00Z',
        content_revisions: [
            {
                id: 'rev-1',
                revision_number: 1,
                body: 'First version text',
                change_summary: 'Initial revision',
                author_type: 'ai',
                created_at: '2026-11-01T10:00:00Z',
                updated_at: '2026-11-01T10:00:00Z'
            },
            {
                id: 'rev-2',
                revision_number: 2,
                body: 'Second version text (latest)',
                change_summary: 'Polished body',
                author_type: 'user',
                created_at: '2026-11-01T11:00:00Z',
                updated_at: '2026-11-01T11:00:00Z'
            }
        ]
    }
];

function createTestApp(db = mockSupabase(mockDraftAssets)) {
    const app = express();
    app.use(express.json());
    app.use('/api/agent', createAgentRouter({ db }));
    return app;
}

test('agent API middleware rejects missing API key with 401', async () => {
    process.env.AGENT_DRAFT_API_KEY = TEST_AGENT_KEY;
    const req = { header: () => null };
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
    };
    let called = false;
    requireAgentDraftApiKey(req, res, () => { called = true; });

    assert.equal(called, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /Unauthorized/);
});

test('agent API middleware rejects incorrect API key with 401', async () => {
    process.env.AGENT_DRAFT_API_KEY = TEST_AGENT_KEY;
    const req = { header: (name) => (name === 'x-api-key' ? 'wrong-key' : null) };
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
    };
    let called = false;
    requireAgentDraftApiKey(req, res, () => { called = true; });

    assert.equal(called, false);
    assert.equal(res.statusCode, 401);
});

test('agent API middleware accepts valid x-api-key header', async () => {
    process.env.AGENT_DRAFT_API_KEY = TEST_AGENT_KEY;
    const req = { header: (name) => (name === 'x-api-key' ? TEST_AGENT_KEY : null) };
    const res = {};
    let called = false;
    requireAgentDraftApiKey(req, res, () => { called = true; });

    assert.equal(called, true);
});

test('agent API middleware accepts valid Authorization Bearer header', async () => {
    process.env.AGENT_DRAFT_API_KEY = TEST_AGENT_KEY;
    const req = { header: (name) => (name === 'authorization' ? `Bearer ${TEST_AGENT_KEY}` : null) };
    const res = {};
    let called = false;
    requireAgentDraftApiKey(req, res, () => { called = true; });

    assert.equal(called, true);
});

test('GET /api/agent/drafts returns formatted draft payload with latest revision body', async () => {
    process.env.AGENT_DRAFT_API_KEY = TEST_AGENT_KEY;
    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/api/agent/drafts`, {
            headers: { 'x-api-key': TEST_AGENT_KEY }
        });
        assert.equal(response.status, 200);
        const data = await response.json();

        assert.equal(data.success, true);
        assert.equal(data.count, 1);
        const item = data.drafts[0];
        assert.equal(item.title, 'Draft Article 1');
        assert.equal(item.content, 'Second version text (latest)');
        assert.equal(item.latest_revision_number, 2);
        assert.equal(item.revisions.length, 2);
    } finally {
        server.close();
    }
});

test('GET /api/agent/drafts/:id returns single draft or 404', async () => {
    process.env.AGENT_DRAFT_API_KEY = TEST_AGENT_KEY;
    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        // Valid id
        const okRes = await fetch(`http://127.0.0.1:${port}/api/agent/drafts/11111111-1111-4111-8111-111111111111`, {
            headers: { 'x-api-key': TEST_AGENT_KEY }
        });
        assert.equal(okRes.status, 200);
        const okData = await okRes.json();
        assert.equal(okData.success, true);
        assert.equal(okData.draft.id, '11111111-1111-4111-8111-111111111111');

        // Unknown id
        const notFoundRes = await fetch(`http://127.0.0.1:${port}/api/agent/drafts/00000000-0000-0000-0000-000000000000`, {
            headers: { 'x-api-key': TEST_AGENT_KEY }
        });
        assert.equal(notFoundRes.status, 404);
        const errData = await notFoundRes.json();
        assert.match(errData.error, /Draft not found/);
    } finally {
        server.close();
    }
});
