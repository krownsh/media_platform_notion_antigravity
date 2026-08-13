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

export async function dispatchHermesWorkflowOnce({
    workerId = process.env.HERMES_DISPATCH_WORKER_ID || `hermes-dispatch-${randomUUID()}`
} = {}) {
    validateHermesWebhookConfig();
    return runHermesDispatchCycle({ workerId });
}

// Kept as a compatibility alias for older manual commands. It is intentionally
// one-shot; Hermes dispatch must never become a background polling process.
export async function runHermesDispatchWorker(options = {}) {
    return dispatchHermesWorkflowOnce(options);
}
