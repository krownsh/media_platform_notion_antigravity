import assert from 'node:assert/strict';
import test from 'node:test';

import {
    processUrlAndWaitForCapture,
    waitForProcessCapture
} from '../../server/services/processResponseService.js';

test('process response adapter waits for the current queue and preserves the established URL result fields', async () => {
    const states = [
        { id: 'capture-1', status: 'accepted' },
        { id: 'capture-1', status: 'finalized', post_id: 'post-1', correlation_id: 'line-message-1' }
    ];

    const result = await processUrlAndWaitForCapture({
        userId: 'user-1',
        url: 'https://example.com/post',
        correlationId: 'line-message-1'
    }, {
        enqueue: async () => ({ id: 'capture-1' }),
        lookup: async () => states.shift(),
        sleep: async () => {},
        now: (() => { let time = 0; return () => time += 10; })()
    });

    assert.equal(result.status, 'finalized');
    assert.equal(result.capture_id, 'capture-1');
    assert.equal(result.data.dbId, 'post-1');
    assert.equal(result.data.originalUrl, 'https://example.com/post');
});

test('process response adapter reports a terminal capture failure', async () => {
    await assert.rejects(
        () => processUrlAndWaitForCapture({ userId: 'user-1', url: 'https://x.com/example/status/1' }, {
            enqueue: async () => ({ id: 'capture-2' }),
            lookup: async () => ({ id: 'capture-2', status: 'failed', error_code: 'X_CAPTURE_FAILED', error_message: 'crawler failed' })
        }),
        error => error.code === 'X_CAPTURE_FAILED' && error.message === 'crawler failed'
    );
});

test('process response adapter has a bounded wait and leaves the durable request intact on timeout', async () => {
    let time = 0;
    await assert.rejects(
        () => waitForProcessCapture({ captureId: 'capture-3', userId: 'user-1', timeoutMs: 1_000, pollIntervalMs: 100 }, {
            lookup: async () => ({ id: 'capture-3', status: 'accepted' }),
            sleep: async () => {},
            now: () => time += 600
        }),
        error => error.code === 'CAPTURE_WAIT_TIMEOUT'
    );
});
