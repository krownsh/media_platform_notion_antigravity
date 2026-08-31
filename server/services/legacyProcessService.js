import { randomUUID } from 'node:crypto';

import {
    enqueueCaptureRequest,
    getCaptureRequest
} from './captureRequestService.js';

const TERMINAL_STATUSES = new Set(['finalized', 'degraded', 'failed']);

function wait(delayMs) {
    return new Promise(resolve => setTimeout(resolve, delayMs));
}

function boundedWaitMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 170_000;
    return Math.min(Math.max(parsed, 1_000), 175_000);
}

export async function waitForCaptureCompletion(input, dependencies = {}) {
    const lookup = dependencies.lookup || getCaptureRequest;
    const sleep = dependencies.sleep || wait;
    const now = dependencies.now || Date.now;
    const timeoutMs = boundedWaitMs(input.timeoutMs);
    const pollIntervalMs = Math.min(Math.max(Number(input.pollIntervalMs) || 500, 100), 2_000);
    const deadline = now() + timeoutMs;

    while (now() < deadline) {
        const capture = await lookup(input.captureId, input.userId);
        if (!capture) throw new Error('Capture request disappeared while processing');
        if (TERMINAL_STATUSES.has(capture.status)) return capture;
        await sleep(pollIntervalMs);
    }

    const timeoutError = new Error('Capture processing timed out; the durable request remains queued');
    timeoutError.code = 'CAPTURE_WAIT_TIMEOUT';
    throw timeoutError;
}

export async function processUrlThroughCaptureQueue(input, dependencies = {}) {
    const enqueue = dependencies.enqueue || enqueueCaptureRequest;
    const capture = await enqueue({
        userId: input.userId,
        url: input.url,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey || input.correlationId || randomUUID(),
        priority: input.priority ?? 50,
        requestMeta: input.requestMeta || {}
    });

    const completed = await waitForCaptureCompletion({
        captureId: capture.id,
        userId: input.userId,
        timeoutMs: input.timeoutMs,
        pollIntervalMs: input.pollIntervalMs
    }, dependencies);

    if (completed.status === 'failed') {
        const captureError = new Error(completed.error_message || 'Capture processing failed');
        captureError.code = completed.error_code || 'CAPTURE_FAILED';
        throw captureError;
    }

    return {
        source: 'capture-worker',
        status: completed.status,
        capture_id: completed.id,
        correlation_id: completed.correlation_id,
        data: {
            dbId: completed.post_id,
            outboxEventId: completed.outbox_event_id,
            originalUrl: input.url,
            original_url: input.url
        }
    };
}
