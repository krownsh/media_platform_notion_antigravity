import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createReviewRouter } from '../../server/routes/reviewRoutes.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

async function withServer(dependencies, run) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.auth = { type: 'supabase_jwt', userId: USER_ID };
        next();
    });
    app.use('/api/review', createReviewRouter(dependencies));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
}

test('review list and packet endpoints pass only the authenticated owner scope', async () => {
    const calls = [];
    await withServer({
        listPackets: async input => { calls.push(['list', input]); return [{ id: 'packet-1', next_action: { kind: 'review_proposal' } }]; },
        loadPacket: async input => { calls.push(['load', input]); return { id: input.packetId, version: 1, next_action: { kind: 'review_proposal' } }; }
    }, async baseUrl => {
        const listResponse = await fetch(`${baseUrl}/api/review/packets`);
        const detailResponse = await fetch(`${baseUrl}/api/review/packets/packet-1`);
        assert.equal(listResponse.status, 200);
        assert.equal((await listResponse.json()).packets[0].id, 'packet-1');
        assert.equal(detailResponse.status, 200);
        assert.equal((await detailResponse.json()).packet.id, 'packet-1');
    });
    assert.deepEqual(calls, [
        ['list', { userId: USER_ID, limit: undefined }],
        ['load', { userId: USER_ID, packetId: 'packet-1' }]
    ]);
});

test('accept endpoint requires optimistic version and cannot accept on behalf of another owner', async () => {
    let decision;
    await withServer({
        decideProposal: async input => {
            decision = input;
            return { id: 'packet-1', version: 2, next_action: { kind: 'awaiting_proposals' } };
        }
    }, async baseUrl => {
        const missingVersion = await fetch(`${baseUrl}/api/review/packets/packet-1/proposals/proposal-1/accept`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
        });
        assert.equal(missingVersion.status, 400);

        const accepted = await fetch(`${baseUrl}/api/review/packets/packet-1/proposals/proposal-1/accept`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ expected_version: 1, user_id: 'attacker-controlled-user' })
        });
        assert.equal(accepted.status, 200);
    });
    assert.deepEqual(decision, {
        userId: USER_ID,
        packetId: 'packet-1',
        proposalId: 'proposal-1',
        action: 'accept',
        expectedVersion: 1,
        editedPayload: null
    });
});

test('resume endpoint retains the authenticated owner and version lock', async () => {
    let resume;
    await withServer({
        resumePacket: async input => {
            resume = input;
            return { id: input.packetId, status: 'open', version: 4, next_action: { kind: 'review_proposal' } };
        }
    }, async baseUrl => {
        const response = await fetch(`${baseUrl}/api/review/packets/packet-1/resume`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ expected_version: 3, user_id: 'attacker-controlled-user' })
        });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).packet.next_action.kind, 'review_proposal');
    });
    assert.deepEqual(resume, { userId: USER_ID, packetId: 'packet-1', expectedVersion: 3 });
});
