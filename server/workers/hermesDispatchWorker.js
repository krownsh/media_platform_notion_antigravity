import { randomUUID } from 'node:crypto';

import {
    claimHermesDispatch,
    completeHermesDispatch,
    failHermesDispatch
} from '../services/hermesDispatchService.js';
import {
    sendHermesWorkflowWebhook,
    validateHermesWebhookConfig
} from '../services/hermesWebhookClient.js';

function wait(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted) return resolve();
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
        }, { once: true });
    });
}

export async function runHermesDispatchCycle({
    workerId,
    claim = claimHermesDispatch,
    send = sendHermesWorkflowWebhook,
    complete = completeHermesDispatch,
    fail = failHermesDispatch
}) {
    const dispatch = await claim(workerId);
    if (!dispatch) return { status: 'empty' };

    try {
        const result = await send(dispatch);
        const delivered = await complete({
            dispatchId: dispatch.id,
            workerId,
            httpStatus: result.httpStatus
        });
        return { status: 'delivered', dispatch: delivered, gateway: result };
    } catch (error) {
        const failed = await fail({
            dispatchId: dispatch.id,
            workerId,
            retryable: error.retryable !== false,
            httpStatus: error.httpStatus,
            errorMessage: error.message
        });
        return { status: failed.status, dispatch: failed, error };
    }
}

export async function runHermesDispatchWorker({
    workerId = process.env.HERMES_DISPATCH_WORKER_ID || `hermes-dispatch-${randomUUID()}`,
    pollIntervalMs = Number(process.env.HERMES_DISPATCH_POLL_MS || 2_000),
    signal
} = {}) {
    validateHermesWebhookConfig();
    pollIntervalMs = Math.min(Math.max(Number(pollIntervalMs) || 2_000, 250), 60_000);
    console.log(`[HermesDispatchWorker] started as ${workerId}`);
    while (!signal?.aborted) {
        try {
            const result = await runHermesDispatchCycle({ workerId });
            if (result.status === 'empty') await wait(pollIntervalMs, signal);
        } catch (error) {
            console.error(`[HermesDispatchWorker] cycle failed: ${error.message}`);
            await wait(pollIntervalMs, signal);
        }
    }
    console.log('[HermesDispatchWorker] stopped');
}
