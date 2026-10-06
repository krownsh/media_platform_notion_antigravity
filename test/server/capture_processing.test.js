import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFallbackCapture, processCaptureRequest } from '../../server/services/captureProcessingService.js';
import { runCaptureWorkerCycle, runCaptureWorkerLoop } from '../../server/workers/captureWorker.js';
import { exitAfterCaptureWorkerFatal } from '../../server/workers/captureWorkerRuntime.js';

const request = {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    url: 'https://example.com/article',
    correlation_id: 'capture-test-1'
};

test('async capture persists normalized source facts without analysis or workflow work', async () => {
    let finalizedInput;
    const result = await processCaptureRequest(request, {
        acquisition: {
            processUrl: async () => ({
                source: 'crawler',
                data: { platform: 'generic', original_url: request.url, content: 'source content' }
            })
        },
        finalizer: async (...args) => {
            finalizedInput = args;
            return { post_id: 'post-1', source_revision_id: 'revision-1', outbox_event_id: null };
        }
    });

    assert.deepEqual(result, {
        status: 'finalized',
        captureQuality: 'complete',
        postId: 'post-1',
        sourceRevisionId: 'revision-1',
        outboxEventId: null
    });
    assert.equal(finalizedInput[0], request.user_id);
    assert.equal(finalizedInput[1], request.correlation_id);
    assert.equal(Object.hasOwn(finalizedInput[3], 'analysis'), false);
    assert.deepEqual(finalizedInput[4], { pipelineVersion: 'capture-v5-owner-guided', captureQuality: 'complete' });
});

test('generic extraction failure becomes a partial link source record', async () => {
    let fallback;
    const result = await processCaptureRequest(request, {
        acquisition: { processUrl: async () => { throw new Error('unreadable page'); } },
        finalizer: async (_userId, _correlationId, source, data) => {
            fallback = { source, data };
            return { post_id: 'post-2', source_revision_id: 'revision-2', outbox_event_id: null };
        }
    });

    assert.deepEqual(result, {
        status: 'finalized',
        captureQuality: 'partial',
        postId: 'post-2',
        sourceRevisionId: 'revision-2',
        outboxEventId: null
    });
    assert.equal(fallback.source, 'fallback');
    assert.equal(fallback.data.original_url, request.url);
    assert.equal(Object.hasOwn(fallback.data, 'analysis'), false);
    assert.match(fallback.data.full_json.capture_error.message, /unreadable page/);
});

test('fallback keeps the running checkout’s owner-facing label and bounded raw failure evidence', () => {
    const fallback = buildFallbackCapture('https://example.com/unreadable', new Error('x'.repeat(5_000)));

    assert.equal(fallback.title, '連結存檔（擷取降級）');
    assert.equal(fallback.full_json.source_type, 'fallback_link');
    assert.equal(fallback.full_json.capture_error.message.length, 4_000);
});

test('image capture finalizes persisted media without crawler or AI work', async () => {
    let acquisitionCalls = 0;
    let finalizedInput;
    const result = await processCaptureRequest({
        ...request,
        input_type: 'image',
        url: null,
        storage_bucket: 'collection_capture_uploads',
        storage_path: `${request.user_id}/captures/image.png`,
        media_content_type: 'image/png',
        media_size_bytes: 1234,
        original_filename: '研究圖.png'
    }, {
        acquisition: { processUrl: async () => { acquisitionCalls += 1; } },
        finalizer: async (...args) => {
            finalizedInput = args;
            return { post_id: 'post-image', source_revision_id: 'revision-image', outbox_event_id: null };
        }
    });

    assert.equal(acquisitionCalls, 0);
    assert.equal(result.status, 'finalized');
    assert.equal(finalizedInput[2], 'upload');
    assert.equal(finalizedInput[3].platform, 'image');
    assert.equal(finalizedInput[3].images[0].storage_bucket, 'collection_capture_uploads');
    assert.deepEqual(finalizedInput[4], { pipelineVersion: 'capture-v5-owner-guided', captureQuality: 'complete' });
    assert.equal(result.outboxEventId, null);
    assert.equal(result.sourceRevisionId, 'revision-image');
});

test('core-platform extraction failure remains retryable and does not save fallback data', async () => {
    let finalizationCalls = 0;
    await assert.rejects(
        processCaptureRequest(
            { ...request, url: 'https://www.threads.net/@user/post/123' },
            {
                acquisition: { processUrl: async () => { throw new Error('crawler blocked'); } },
                finalizer: async () => { finalizationCalls += 1; }
            }
        ),
        /crawler blocked/
    );
    assert.equal(finalizationCalls, 0);
});

test('finalization failure never replaces extracted data with a fallback link', async () => {
    let finalizationCalls = 0;
    await assert.rejects(
        processCaptureRequest(request, {
            acquisition: {
                processUrl: async () => ({
                    source: 'crawler',
                    data: { platform: 'generic', original_url: request.url, content: 'valuable source' }
                })
            },
            finalizer: async () => {
                finalizationCalls += 1;
                throw new Error('database unavailable');
            }
        }),
        /database unavailable/
    );
    assert.equal(finalizationCalls, 1);
});

test('worker completes a leased request through the durable status service', async () => {
    const calls = [];
    const result = await runCaptureWorkerCycle({
        workerId: 'worker-test',
        claim: async () => request,
        processRequest: async () => ({
            status: 'finalized',
            captureQuality: 'complete',
            postId: 'post-3',
            sourceRevisionId: 'revision-3',
            outboxEventId: null
        }),
        complete: async (input) => {
            calls.push(input);
            return { id: request.id, status: input.status };
        },
        fail: async () => { throw new Error('fail should not be called'); }
    });

    assert.equal(result.status, 'finalized');
    assert.deepEqual(calls[0], {
        requestId: request.id,
        workerId: 'worker-test',
        status: 'finalized',
        captureQuality: 'complete',
        postId: 'post-3',
        sourceRevisionId: 'revision-3',
        outboxEventId: null
    });
    assert.equal(Object.hasOwn(result, 'hermesDispatch'), false);
});

test('worker records retry state when processing fails', async () => {
    let failureInput;
    const result = await runCaptureWorkerCycle({
        workerId: 'worker-test',
        claim: async () => request,
        processRequest: async () => { throw new Error('temporary failure'); },
        complete: async () => { throw new Error('complete should not be called'); },
        fail: async (input) => {
            failureInput = input;
            return { id: request.id, status: 'accepted' };
        }
    });

    assert.equal(result.status, 'accepted');
    assert.equal(failureInput.retryable, true);
    assert.match(failureInput.errorMessage, /temporary failure/);
});

test('worker treats a transient claim failure as retryable instead of terminating the polling loop', async () => {
    const result = await runCaptureWorkerCycle({
        workerId: 'worker-test',
        claim: async () => { throw new Error('fetch failed'); },
        processRequest: async () => { throw new Error('processRequest should not be called'); },
        complete: async () => { throw new Error('complete should not be called'); },
        fail: async () => { throw new Error('fail should not be called'); }
    });

    assert.equal(result.status, 'retry');
    assert.match(result.error.message, /fetch failed/);
});

test('worker waits before retrying a failed claim and then continues polling', async () => {
    const controller = new AbortController();
    const delays = [];
    let cycleCount = 0;

    await runCaptureWorkerLoop({
        workerId: 'worker-test',
        pollIntervalMs: 250,
        signal: controller.signal,
        cycle: async () => {
            cycleCount += 1;
            if (cycleCount === 1) return { status: 'retry', error: new Error('fetch failed') };
            controller.abort();
            return { status: 'empty' };
        },
        sleep: async delayMs => { delays.push(delayMs); },
        log: { warn: () => {} }
    });

    assert.equal(cycleCount, 2);
    assert.deepEqual(delays, [250]);
});

test('worker retries an unexpected cycle error instead of leaving the process online without polling', async () => {
    const controller = new AbortController();
    const delays = [];
    const errors = [];
    let cycleCount = 0;

    await runCaptureWorkerLoop({
        workerId: 'worker-test',
        pollIntervalMs: 250,
        signal: controller.signal,
        cycle: async () => {
            cycleCount += 1;
            if (cycleCount === 1) throw new Error('completion fetch failed');
            controller.abort();
            return { status: 'empty' };
        },
        sleep: async delayMs => { delays.push(delayMs); },
        log: { error: message => { errors.push(message); }, warn: () => {} }
    });

    assert.equal(cycleCount, 2);
    assert.deepEqual(delays, [250]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /completion fetch failed/);
});

test('an unrecoverable worker error exits non-zero so PM2 can restart it', () => {
    const logs = [];
    const exitCodes = [];
    const error = new Error('worker bootstrap failed');

    exitAfterCaptureWorkerFatal(error, {
        log: { error: (...args) => { logs.push(args); } },
        exit: code => { exitCodes.push(code); }
    });

    assert.deepEqual(logs, [['[CaptureWorker] fatal error:', error]]);
    assert.deepEqual(exitCodes, [1]);
});
