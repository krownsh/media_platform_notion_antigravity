import crypto from 'node:crypto';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 64 * 1024;

export class HermesWebhookError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'HermesWebhookError';
        this.code = options.code || 'HERMES_WEBHOOK_FAILED';
        this.httpStatus = options.httpStatus ?? null;
        this.retryable = options.retryable !== false;
    }
}

function isLoopback(hostname) {
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}

export function normalizeHermesWebhookUrl(value, options = {}) {
    let url;
    try {
        url = new URL(String(value || '').trim());
    } catch {
        throw new HermesWebhookError('HERMES_WEBHOOK_URL must be a valid URL', {
            code: 'HERMES_WEBHOOK_CONFIG_INVALID',
            retryable: false
        });
    }
    if (url.username || url.password || url.search || url.hash) {
        throw new HermesWebhookError('HERMES_WEBHOOK_URL must not include credentials, query, or fragment', {
            code: 'HERMES_WEBHOOK_CONFIG_INVALID',
            retryable: false
        });
    }
    const allowHttp = options.allowInsecureHttp === true || isLoopback(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && allowHttp)) {
        throw new HermesWebhookError('HERMES_WEBHOOK_URL must use HTTPS unless it is loopback', {
            code: 'HERMES_WEBHOOK_CONFIG_INVALID',
            retryable: false
        });
    }
    if (!/\/webhooks\/[a-zA-Z0-9._-]+\/?$/.test(url.pathname)) {
        throw new HermesWebhookError('HERMES_WEBHOOK_URL must target /webhooks/<route-name>', {
            code: 'HERMES_WEBHOOK_CONFIG_INVALID',
            retryable: false
        });
    }
    return url.toString();
}

export function signHermesWebhook(body, secret, timestamp) {
    const safeSecret = String(secret || '');
    if (!safeSecret || safeSecret === 'INSECURE_NO_AUTH') {
        throw new HermesWebhookError('A real HERMES_WEBHOOK_SECRET is required', {
            code: 'HERMES_WEBHOOK_CONFIG_INVALID',
            retryable: false
        });
    }
    return crypto
        .createHmac('sha256', safeSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
}

export function validateHermesWebhookConfig(options = {}) {
    const url = normalizeHermesWebhookUrl(
        options.url || process.env.HERMES_WEBHOOK_URL,
        {
            allowInsecureHttp: options.allowInsecureHttp
                ?? process.env.HERMES_WEBHOOK_ALLOW_INSECURE_HTTP === 'true'
        }
    );
    const secret = options.secret || process.env.HERMES_WEBHOOK_SECRET;
    signHermesWebhook('', secret, '0');
    return { url, secret };
}

function acceptedResponse(status, payload) {
    return (
        status === 202 && payload?.status === 'accepted'
    ) || (
        status === 200 && payload?.status === 'duplicate'
    );
}

async function readBoundedJson(response) {
    const text = (await response.text()).slice(0, MAX_RESPONSE_BYTES);
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { status: 'invalid_json' };
    }
}

export async function sendHermesWorkflowWebhook(dispatch, options = {}) {
    const { url, secret } = validateHermesWebhookConfig(options);
    const timestamp = String(Math.floor((options.now || Date.now()) / 1000));
    const body = JSON.stringify({
        event_type: dispatch.event_type || 'collection.workflow.ready.v1',
        schema_version: 1,
        dispatch_id: dispatch.id,
        workflow_id: dispatch.workflow_id,
        post_id: dispatch.post_id
    });
    const signature = signHermesWebhook(body, secret, timestamp);
    const timeoutMs = Math.min(Math.max(Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS, 1_000), 30_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
        response = await (options.fetchImpl || fetch)(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-webhook-signature-v2': signature,
                'x-webhook-timestamp': timestamp,
                'x-request-id': String(dispatch.request_id)
            },
            body,
            signal: controller.signal
        });
    } catch (error) {
        const timedOut = error?.name === 'AbortError';
        throw new HermesWebhookError(
            timedOut ? 'Hermes webhook timed out' : `Hermes webhook request failed: ${error.message}`,
            { code: timedOut ? 'HERMES_WEBHOOK_TIMEOUT' : 'HERMES_WEBHOOK_UNREACHABLE', retryable: true }
        );
    } finally {
        clearTimeout(timer);
    }

    const payload = await readBoundedJson(response);
    if (
        acceptedResponse(response.status, payload)
        && payload.delivery_id === String(dispatch.request_id)
    ) {
        return { httpStatus: response.status, status: payload.status, deliveryId: payload.delivery_id || null };
    }

    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new HermesWebhookError(`Hermes webhook rejected the dispatch (HTTP ${response.status})`, {
        code: 'HERMES_WEBHOOK_REJECTED',
        httpStatus: response.status,
        retryable
    });
}
