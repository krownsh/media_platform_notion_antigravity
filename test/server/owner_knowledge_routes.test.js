import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createOwnerKnowledgeRouter } from '../../server/routes/ownerKnowledgeRoutes.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

async function withServer(dependencies, run) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.auth = { userId: USER_ID }; next(); });
    app.use('/api/owner-knowledge', createOwnerKnowledgeRouter(dependencies));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    try { await run(`http://127.0.0.1:${server.address().port}`); }
    finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('owner knowledge routes retain the authenticated owner and keep POC approval separate', async () => {
    const calls = [];
    await withServer({
        listOwnerTopics: async input => { calls.push(['topics', input]); return [{ id: 'topic-1', label: 'UI UX' }]; },
        listLegacyProjects: async input => { calls.push(['legacy', input]); return [{ id: 'legacy-1', title: 'Existing project' }]; },
        importLegacyProjectToCatalog: async input => { calls.push(['import', input]); return { id: 'catalog-1', title: 'Existing project' }; },
        createPocProposal: async input => { calls.push(['propose', input]); return { id: 'poc-1', status: 'proposed' }; },
        decidePocProposal: async input => { calls.push(['decide', input]); return { id: 'poc-1', status: 'approved', version: 2 }; }
    }, async baseUrl => {
        const topics = await fetch(`${baseUrl}/api/owner-knowledge/topics`);
        assert.equal(topics.status, 200);
        assert.equal((await topics.json()).topics[0].label, 'UI UX');
        const legacy = await fetch(`${baseUrl}/api/owner-knowledge/legacy-projects`);
        assert.equal(legacy.status, 200);
        assert.equal((await legacy.json()).projects[0].id, 'legacy-1');
        const imported = await fetch(`${baseUrl}/api/owner-knowledge/legacy-projects/legacy-1/import`, { method: 'POST' });
        assert.equal(imported.status, 201);
        const proposal = await fetch(`${baseUrl}/api/owner-knowledge/project-references/ref-1/poc-proposals`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ objective: 'Try in an isolated workspace' })
        });
        assert.equal(proposal.status, 201);
        const approval = await fetch(`${baseUrl}/api/owner-knowledge/poc-proposals/poc-1/approve`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expected_version: 1, user_id: 'attacker' })
        });
        assert.equal(approval.status, 200);
    });
    assert.deepEqual(calls, [
        ['topics', { userId: USER_ID }],
        ['legacy', { userId: USER_ID }],
        ['import', { userId: USER_ID, legacyProjectId: 'legacy-1' }],
        ['propose', { userId: USER_ID, projectReferenceId: 'ref-1', objective: 'Try in an isolated workspace', isolationSpec: {} }],
        ['decide', { userId: USER_ID, proposalId: 'poc-1', action: 'approve', expectedVersion: 1 }]
    ]);
});
