import test from 'node:test';
import assert from 'node:assert/strict';
import { processCaptureRequest } from '../../server/services/captureProcessingService.js';
import { runCaptureWorkerCycle } from '../../server/workers/captureWorker.js';

const request = {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    url: 'https://example.com/article',
    correlation_id: 'capture-test-1'
};

test('async capture restores URL base analysis before finalization', async () => {
    let finalizedInput;
    let workflowInput;
    const result = await processCaptureRequest(request, {
        acquisition: {
            processUrl: async () => ({
                source: 'crawler',
                data: { platform: 'generic', original_url: request.url, content: 'source content' }
            })
        },
        finalizer: async (...args) => {
            finalizedInput = args;
            return { post_id: 'post-1', outbox_event_id: 'event-1' };
        },
        analyzer: async data => ({
            data: { ...data, analysis: { primary_category: 'tool', summary: '摘要', tags: ['sdk'], topics: ['tooling'] } },
            baseAnalysis: { status: 'completed', source: 'capture_ai', errors: [] }
        }),
        workflowUpdater: async input => { workflowInput = input; }
    });

    assert.deepEqual(result, {
        status: 'finalized',
        captureQuality: 'complete',
        postId: 'post-1',
        outboxEventId: 'event-1'
    });
    assert.equal(finalizedInput[0], request.user_id);
    assert.equal(finalizedInput[1], request.correlation_id);
    assert.deepEqual(finalizedInput[3].analysis, { primary_category: 'tool', summary: '摘要', tags: ['sdk'], topics: ['tooling'] });
    assert.deepEqual(finalizedInput[4], { pipelineVersion: 'capture-v3-async' });
    assert.deepEqual(workflowInput, {
        outboxEventId: 'event-1',
        sourceType: 'url_capture',
        baseAnalysis: { status: 'completed', source: 'capture_ai', errors: [] }
    });
});

test('generic extraction failure becomes a degraded link record', async () => {
    let fallback;
    const result = await processCaptureRequest(request, {
        acquisition: { processUrl: async () => { throw new Error('unreadable page'); } },
        finalizer: async (_userId, _correlationId, source, data) => {
            fallback = { source, data };
            return { post_id: 'post-2', outbox_event_id: 'event-2' };
        }
    });

    assert.equal(result.status, 'degraded');
    assert.equal(fallback.source, 'fallback');
    assert.equal(fallback.data.original_url, request.url);
    assert.match(fallback.data.analysis.summary, /unreadable page/);
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
            return { post_id: 'post-image', outbox_event_id: 'event-image' };
        },
        workflowUpdater: async () => {}
    });

    assert.equal(acquisitionCalls, 0);
    assert.equal(result.status, 'finalized');
    assert.equal(finalizedInput[2], 'upload');
    assert.equal(finalizedInput[3].platform, 'image');
    assert.equal(finalizedInput[3].images[0].storage_bucket, 'collection_capture_uploads');
    assert.deepEqual(finalizedInput[4], { pipelineVersion: 'capture-v4-image-async' });
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
            outboxEventId: 'event-3'
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
        outboxEventId: 'event-3'
    });
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
