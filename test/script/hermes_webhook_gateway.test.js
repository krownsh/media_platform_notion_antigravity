import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    HermesWebhookError,
    normalizeHermesWebhookUrl,
    sendHermesWorkflowWebhook,
    signHermesWebhook
} from '../../server/services/hermesWebhookClient.js';
import { runHermesDispatchCycle } from '../../server/workers/hermesDispatchWorker.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOW_MS = Date.parse('2026-08-12T10:00:00.000Z');
const TIMESTAMP = String(Math.floor(NOW_MS / 1000));
const SECRET = 'test-only-hermes-webhook-secret';

function dispatch(overrides = {}) {
    return {
        id: 'dispatch-1',
        request_id: '11111111-1111-4111-8111-111111111111',
        workflow_id: '22222222-2222-4222-8222-222222222222',
        post_id: '33333333-3333-4333-8333-333333333333',
        event_type: 'collection.workflow.ready.v1',
        status: 'processing',
        ...overrides
    };
}

function response(status, payload) {
    return {
        status,
        text: async () => JSON.stringify(payload)
    };
}

test('Stage H keeps webhook delivery separate from capture and post workflow state', () => {
    const deployment = fs.readFileSync(
        path.join(projectRoot, 'database', 'deployments', 'stage_h_hermes_webhook_dispatch.sql'),
        'utf8'
    );
    assert.match(deployment, /create table if not exists public\.collection_hermes_dispatches/);
    assert.match(deployment, /for update skip locked/);
    assert.match(deployment, /request_id uuid not null/);
    assert.match(deployment, /unique \(workflow_id, dispatch_version\)/);
    assert.match(deployment, /after insert on public\.collection_post_workflows/);
    assert.match(deployment, /do not automatically backfill existing workflows/i);
    assert.match(deployment, /alter table public\.collection_hermes_dispatches enable row level security/);
    assert.match(deployment, /revoke all on table public\.collection_hermes_dispatches from public, anon, authenticated/);
    assert.doesNotMatch(deployment, /insert into public\.collection_hermes_dispatches[\s\S]+select[\s\S]+collection_post_workflows/i);
});

test('Stage I uses a singleton Agent slot and one-shot dispatch only', () => {
    const deployment = fs.readFileSync(
        path.join(projectRoot, 'database', 'deployments', 'stage_i_hermes_single_agent.sql'),
        'utf8'
    );
    assert.match(deployment, /collection_hermes_agent_slots/);
    assert.match(deployment, /for update/);
    assert.match(deployment, /agent_status in \('pending', 'failed'\)/);
    assert.match(deployment, /start_collection_hermes_agent/);
    assert.match(deployment, /heartbeat_collection_hermes_agent/);
    assert.match(deployment, /finish_collection_hermes_agent/);
    assert.match(deployment, /p_result_status not in \('awaiting_user', 'completed', 'failed'\)/);
    assert.match(deployment, /request_id = uuid_generate_v4\(\)/);
    assert.doesNotMatch(deployment, /create extension\s+(pg_cron|realtime)/i);

    const worker = fs.readFileSync(
        path.join(projectRoot, 'server', 'workers', 'hermesDispatchWorker.js'),
        'utf8'
    );
    assert.match(worker, /dispatchHermesWorkflowOnce/);
    assert.doesNotMatch(worker, /while \(!signal\?\.aborted\)/);
});

test('Hermes signature uses body-only (generic HMAC-SHA256 path)', () => {
    const body = '{"event_type":"collection.workflow.ready.v1"}';
    // Gateway validates: hmac(secret, body_bytes) — no timestamp prefix
    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    assert.equal(signHermesWebhook(body, SECRET, TIMESTAMP), expected);
    assert.throws(
        () => signHermesWebhook(body, 'INSECURE_NO_AUTH', TIMESTAMP),
        error => error instanceof HermesWebhookError && error.retryable === false
    );
});

test('webhook URL requires a named route and secure transport outside loopback', () => {
    assert.equal(
        normalizeHermesWebhookUrl('https://hermes.example.test/webhooks/media-workflow'),
        'https://hermes.example.test/webhooks/media-workflow'
    );
    assert.equal(
        normalizeHermesWebhookUrl('http://127.0.0.1:8644/webhooks/media-workflow'),
        'http://127.0.0.1:8644/webhooks/media-workflow'
    );
    assert.throws(() => normalizeHermesWebhookUrl('http://hermes.example.test/webhooks/media-workflow'));
    assert.throws(() => normalizeHermesWebhookUrl('https://hermes.example.test/health'));
    assert.throws(() => normalizeHermesWebhookUrl('https://user:pass@hermes.example.test/webhooks/media-workflow'));
});

test('dispatch sends only identifiers with stable idempotency and accepts 202', async () => {
    let request;
    const result = await sendHermesWorkflowWebhook(dispatch(), {
        url: 'https://hermes.example.test/webhooks/media-workflow',
        secret: SECRET,
        now: NOW_MS,
        fetchImpl: async (url, options) => {
            request = { url, options };
            return response(202, {
                status: 'accepted',
                delivery_id: dispatch().request_id
            });
        }
    });

    const payload = JSON.parse(request.options.body);
    assert.deepEqual(Object.keys(payload), [
        'event_type', 'schema_version', 'dispatch_id', 'workflow_id', 'post_id'
    ]);
    assert.equal(request.options.headers['x-request-id'], dispatch().request_id);
    assert.equal(request.options.headers['x-webhook-timestamp'], TIMESTAMP);
    assert.equal(
        request.options.headers['x-webhook-signature'],
        signHermesWebhook(request.options.body, SECRET, TIMESTAMP)
    );
    assert.deepEqual(result, {
        httpStatus: 202,
        status: 'accepted',
        deliveryId: dispatch().request_id
    });
});

test('Hermes duplicate response completes the same durable delivery', async () => {
    const result = await sendHermesWorkflowWebhook(dispatch(), {
        url: 'https://hermes.example.test/webhooks/media-workflow',
        secret: SECRET,
        now: NOW_MS,
        fetchImpl: async () => response(200, {
            status: 'duplicate',
            delivery_id: dispatch().request_id
        })
    });
    assert.equal(result.status, 'duplicate');
    assert.equal(result.httpStatus, 200);
});

test('Hermes documented 200 delivered response completes the same durable delivery', async () => {
    const result = await sendHermesWorkflowWebhook(dispatch(), {
        url: 'https://hermes.example.test/webhooks/media-workflow',
        secret: SECRET,
        now: NOW_MS,
        fetchImpl: async () => response(200, {
            status: 'delivered',
            delivery_id: dispatch().request_id
        })
    });
    assert.equal(result.status, 'delivered');
    assert.equal(result.httpStatus, 200);
});

test('gateway rejects an accepted response for another delivery id', async () => {
    await assert.rejects(
        () => sendHermesWorkflowWebhook(dispatch(), {
            url: 'https://hermes.example.test/webhooks/media-workflow',
            secret: SECRET,
            now: NOW_MS,
            fetchImpl: async () => response(202, {
                status: 'accepted',
                delivery_id: '44444444-4444-4444-8444-444444444444'
            })
        }),
        error => error instanceof HermesWebhookError && error.retryable === false
    );
});

test('gateway classifies retryable and permanent HTTP failures', async () => {
    await assert.rejects(
        () => sendHermesWorkflowWebhook(dispatch(), {
            url: 'https://hermes.example.test/webhooks/media-workflow',
            secret: SECRET,
            now: NOW_MS,
            fetchImpl: async () => response(429, { error: 'rate limited' })
        }),
        error => error.httpStatus === 429 && error.retryable === true
    );
    await assert.rejects(
        () => sendHermesWorkflowWebhook(dispatch(), {
            url: 'https://hermes.example.test/webhooks/media-workflow',
            secret: SECRET,
            now: NOW_MS,
            fetchImpl: async () => response(401, { error: 'bad signature' })
        }),
        error => error.httpStatus === 401 && error.retryable === false
    );
});

test('worker cycle completes accepted work and records failure policy', async () => {
    const claimed = dispatch();
    let completeInput;
    const delivered = await runHermesDispatchCycle({
        workerId: 'dispatcher:test',
        claim: async () => claimed,
        send: async () => ({ httpStatus: 202, status: 'accepted' }),
        complete: async input => {
            completeInput = input;
            return { ...claimed, status: 'delivered' };
        },
        fail: async () => assert.fail('fail should not be called')
    });
    assert.equal(delivered.status, 'delivered');
    assert.deepEqual(completeInput, {
        dispatchId: claimed.id,
        workerId: 'dispatcher:test',
        httpStatus: 202
    });

    let failureInput;
    const rejected = await runHermesDispatchCycle({
        workerId: 'dispatcher:test',
        claim: async () => claimed,
        send: async () => {
            throw new HermesWebhookError('bad signature', {
                httpStatus: 401,
                retryable: false
            });
        },
        complete: async () => assert.fail('complete should not be called'),
        fail: async input => {
            failureInput = input;
            return { ...claimed, status: 'dead_letter' };
        }
    });
    assert.equal(rejected.status, 'dead_letter');
    assert.equal(failureInput.retryable, false);
    assert.equal(failureInput.httpStatus, 401);
});

test('worker cycle is silent when no dispatch is available', async () => {
    assert.deepEqual(await runHermesDispatchCycle({
        workerId: 'dispatcher:test',
        claim: async () => null
    }), { status: 'empty' });
});
