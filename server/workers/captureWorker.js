import { randomUUID } from 'crypto';
import {
    claimCaptureRequest,
    completeCaptureRequest,
    failCaptureRequest
} from '../services/captureRequestService.js';
import { processCaptureRequest } from '../services/captureProcessingService.js';
import { dispatchHermesWorkflowOnce } from './hermesDispatchWorker.js';

export async function runCaptureWorkerCycle({
    workerId,
    claim = claimCaptureRequest,
    processRequest = processCaptureRequest,
    complete = completeCaptureRequest,
    fail = failCaptureRequest,
    dispatchNext = null
}) {
    const request = await claim(workerId);
    if (!request) return { status: 'empty' };

    try {
        const result = await processRequest(request);
        const completed = await complete({
            requestId: request.id,
            workerId,
            ...result
        });
        let hermesDispatch = null;
        if (dispatchNext && ['finalized', 'degraded'].includes(completed.status)) {
            try {
                hermesDispatch = await dispatchNext({
                    workerId: `capture:${workerId}:${request.id}`
                });
            } catch (dispatchError) {
                // Capture is already durable. Hermes can be started by its Cron
                // or a manual wake; never turn a successful capture into a
                // failed capture because the local Gateway is unavailable.
                console.error(`[CaptureWorker] Hermes one-shot dispatch failed: ${dispatchError.message}`);
            }
        }
        return { status: completed.status, request: completed, hermesDispatch };
    } catch (error) {
        const failed = await fail({
            requestId: request.id,
            workerId,
            retryable: true,
            errorCode: error.code || 'CAPTURE_PROCESSING_FAILED',
            errorMessage: error.message
        });
        return { status: failed.status, request: failed, error };
    }
}

export async function runCaptureWorker({
    workerId = process.env.CAPTURE_WORKER_ID || `capture-worker-${randomUUID()}`,
    pollIntervalMs = Number(process.env.CAPTURE_WORKER_POLL_MS || 2000),
    signal,
    dispatchNext = dispatchHermesWorkflowOnce
} = {}) {
    console.log(`[CaptureWorker] started as ${workerId}`);
    while (!signal?.aborted) {
        const result = await runCaptureWorkerCycle({ workerId, dispatchNext });
        if (result.status === 'empty') {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
    }
    console.log('[CaptureWorker] stopped');
}
