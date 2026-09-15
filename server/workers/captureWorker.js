import { randomUUID } from 'crypto';
import {
    claimCaptureRequest,
    completeCaptureRequest,
    failCaptureRequest
} from '../services/captureRequestService.js';
import { processCaptureRequest } from '../services/captureProcessingService.js';

export async function runCaptureWorkerCycle({
    workerId,
    claim = claimCaptureRequest,
    processRequest = processCaptureRequest,
    complete = completeCaptureRequest,
    fail = failCaptureRequest
}) {
    let request;
    try {
        request = await claim(workerId);
    } catch (error) {
        return { status: 'retry', error };
    }

    if (!request) return { status: 'empty' };

    try {
        const result = await processRequest(request);
        const completed = await complete({
            requestId: request.id,
            workerId,
            ...result
        });
        return { status: completed.status, request: completed };
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

function sleep(delayMs) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function runCaptureWorkerLoop({
    workerId,
    pollIntervalMs,
    signal,
    cycle = runCaptureWorkerCycle,
    sleep: wait = sleep,
    log = console
}) {
    while (!signal?.aborted) {
        let result;
        let errorAlreadyLogged = false;
        try {
            result = await cycle({ workerId });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.error(`[CaptureWorker] cycle failed; retrying in ${pollIntervalMs}ms: ${message}`);
            result = { status: 'retry', error };
            errorAlreadyLogged = true;
        }

        if (result.status === 'retry' && !errorAlreadyLogged) {
            log.warn(`[CaptureWorker] claim failed; retrying in ${pollIntervalMs}ms: ${result.error.message}`);
        }

        if (!signal?.aborted && (result.status === 'empty' || result.status === 'retry')) {
            await wait(pollIntervalMs);
        }
    }
}

export async function runCaptureWorker({
    workerId = process.env.CAPTURE_WORKER_ID || `capture-worker-${randomUUID()}`,
    pollIntervalMs = Number(process.env.CAPTURE_WORKER_POLL_MS || 2000),
    signal
} = {}) {
    console.log(`[CaptureWorker] started as ${workerId}`);
    await runCaptureWorkerLoop({ workerId, pollIntervalMs, signal });
    console.log('[CaptureWorker] stopped');
}
