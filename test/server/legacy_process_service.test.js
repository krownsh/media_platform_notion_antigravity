import assert from 'node:assert/strict';
import test from 'node:test';

import {
    processUrlThroughCaptureQueue,
    waitForCaptureCompletion
} from '../../server/services/legacyProcessService.js';

test('legacy process enqueues first and returns only after Capture finalization', async () => {
    const calls = [];
    const states = [
        { id: 'capture-1', status: 'accepted' },
        {
            id: 'capture-1',
            status: 'finalized',
            post_id: 'post-1',
            outbox_event_id: 'outbox-1',
            correlation_id: 'line-message-1'
        }
    ];

    const result = await processUrlThroughCaptureQueue({
        userId: 'user-1',
        url: 'https://example.com/post',
        correlationId: 'line-message-1',
        idempotencyKey: 'line-message-1'
    }, {
        enqueue: async input => {
            calls.push(['enqueue', input]);
            return { id: 'capture-1' };
        },
        lookup: async () => {
            calls.push(['lookup']);
            return states.shift();
        },
        sleep: async () => {},
        now: (() => {
            let time = 0;
            return () => time += 10;
        })()
    });

    assert.equal(calls[0][0], 'enqueue');
    assert.equal(result.status, 'finalized');
    assert.equal(result.capture_id, 'capture-1');
    assert.equal(result.data.dbId, 'post-1');
    assert.equal(result.data.originalUrl, 'https://example.com/post');
});

test('legacy process reports a durable Capture failure', async () => {
    await assert.rejects(
        () => processUrlThroughCaptureQueue({
            userId: 'user-1',
            url: 'https://x.com/example/status/1',
            correlationId: 'line-message-2'
        }, {
            enqueue: async () => ({ id: 'capture-2' }),
            lookup: async () => ({
                id: 'capture-2',
                status: 'failed',
                error_code: 'X_CAPTURE_FAILED',
                error_message: 'crawler failed'
            })
        }),
        error => error.code === 'X_CAPTURE_FAILED' && error.message === 'crawler failed'
    );
});

test('capture completion wait is bounded and does not create a resident loop', async () => {
    let time = 0;
    await assert.rejects(
        () => waitForCaptureCompletion({
            captureId: 'capture-3',
            userId: 'user-1',
            timeoutMs: 1_000,
            pollIntervalMs: 100
        }, {
            lookup: async () => ({ id: 'capture-3', status: 'accepted' }),
            sleep: async () => {},
            now: () => time += 600
        }),
        error => error.code === 'CAPTURE_WAIT_TIMEOUT'
    );
});
