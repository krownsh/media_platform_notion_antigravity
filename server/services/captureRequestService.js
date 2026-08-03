import { supabase } from '../supabaseClient.js';

export function validateCaptureUrl(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 4096) {
        throw new Error('url must be a non-empty HTTP(S) URL up to 4096 characters');
    }

    let parsed;
    try {
        parsed = new URL(value.trim());
    } catch {
        throw new Error('url must be a valid HTTP(S) URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('url must be a public HTTP(S) URL without embedded credentials');
    }

    return parsed.toString();
}

function assertRpcResult(data, error, action) {
    if (error) {
        const requestError = new Error(`${action} failed: ${error.message}`);
        requestError.code = error.code;
        throw requestError;
    }
    if (!data) throw new Error(`${action} returned no request`);
    return data;
}

export async function enqueueCaptureRequest(input, supabaseClient = supabase) {
    const url = validateCaptureUrl(input.url);
    const { data, error } = await supabaseClient
        .rpc('enqueue_collection_capture_request', {
            p_user_id: input.userId,
            p_url: url,
            p_idempotency_key: input.idempotencyKey,
            p_correlation_id: input.correlationId,
            p_priority: input.priority ?? 50,
            p_request_meta: input.requestMeta || {}
        })
        .single();

    return assertRpcResult(data, error, 'Capture enqueue');
}

export async function enqueueImageCaptureRequest(input, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .rpc('enqueue_collection_image_capture_request', {
            p_user_id: input.userId,
            p_storage_bucket: input.storageBucket,
            p_storage_path: input.storagePath,
            p_content_type: input.contentType,
            p_size_bytes: input.sizeBytes,
            p_original_filename: input.originalFilename,
            p_idempotency_key: input.idempotencyKey,
            p_correlation_id: input.correlationId,
            p_priority: input.priority ?? 50,
            p_request_meta: input.requestMeta || {}
        })
        .single();

    return assertRpcResult(data, error, 'Image capture enqueue');
}

export async function getCaptureRequest(requestId, userId, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .from('collection_capture_requests')
        .select('id, input_type, url, original_filename, media_content_type, media_size_bytes, status, attempt_count, max_attempts, capture_quality, post_id, outbox_event_id, error_code, error_message, correlation_id, created_at, updated_at, started_at, finalized_at, failed_at')
        .eq('id', requestId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw new Error(`Capture lookup failed: ${error.message}`);
    return data || null;
}

export async function claimCaptureRequest(workerId, leaseSeconds = 900, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .rpc('claim_collection_capture_request', {
            p_worker_id: workerId,
            p_lease_seconds: leaseSeconds
        })
        .maybeSingle();

    if (error) throw new Error(`Capture claim failed: ${error.message}`);
    return data || null;
}

export async function completeCaptureRequest(input, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .rpc('complete_collection_capture_request', {
            p_request_id: input.requestId,
            p_worker_id: input.workerId,
            p_status: input.status,
            p_capture_quality: input.captureQuality,
            p_post_id: input.postId,
            p_outbox_event_id: input.outboxEventId
        })
        .single();

    return assertRpcResult(data, error, 'Capture completion');
}

export async function failCaptureRequest(input, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .rpc('fail_collection_capture_request', {
            p_request_id: input.requestId,
            p_worker_id: input.workerId,
            p_retryable: input.retryable !== false,
            p_error_code: input.errorCode || 'CAPTURE_FAILED',
            p_error_message: String(input.errorMessage || 'Unknown capture failure').slice(0, 4000)
        })
        .single();

    return assertRpcResult(data, error, 'Capture failure update');
}
