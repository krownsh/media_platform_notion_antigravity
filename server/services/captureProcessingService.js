import { orchestrator } from './orchestrator.js';
import { finalizeCapture } from './captureFinalizationService.js';

export function isCoreCaptureUrl(url) {
    return /(^|\.)threads\.(net|com)$|(^|\.)(twitter\.com|x\.com)$/i.test(new URL(url).hostname);
}

export function buildFallbackCapture(url, error) {
    return {
        platform: 'generic',
        original_url: url,
        title: '連結存檔（擷取降級）',
        content: url,
        full_json: {
            source_type: 'url_capture',
            capture: {
                quality: 'degraded',
                error: String(error?.message || 'Unknown extraction failure').slice(0, 4000)
            }
        }
    };
}

export function buildImageCapture(request) {
    if (!request.storage_bucket || !request.storage_path || !request.media_content_type) {
        throw new Error('Image capture is missing persisted storage metadata');
    }
    const storageUrl = `storage://${request.storage_bucket}/${request.storage_path}`;
    return {
        source_type: 'image_upload', platform: 'image', original_url: storageUrl,
        title: request.original_filename || '圖片上傳', author: '圖片上傳', authorHandle: null, content: null,
        full_json: { source_type: 'image_upload', storage: { bucket: request.storage_bucket, path: request.storage_path, content_type: request.media_content_type, size_bytes: request.media_size_bytes, original_filename: request.original_filename || null } },
        images: [{ url: storageUrl, storage_bucket: request.storage_bucket, storage_path: request.storage_path, content_type: request.media_content_type, byte_size: request.media_size_bytes, original_filename: request.original_filename || null }]
    };
}

export async function processCaptureRequest(request, { acquisition = orchestrator, finalizer = finalizeCapture } = {}) {
    if (request.input_type === 'image') {
        const finalization = await finalizer(request.user_id, request.correlation_id, 'upload', buildImageCapture(request), { pipelineVersion: 'capture-v5-intake-only' });
        return { status: 'finalized', captureQuality: 'complete', postId: finalization.post_id, outboxEventId: null };
    }

    let result;
    try {
        result = await acquisition.processUrl(request.url);
        if (!result?.data) throw new Error('Crawler returned no normalized data');
    } catch (error) {
        if (isCoreCaptureUrl(request.url)) throw error;
        const finalization = await finalizer(request.user_id, request.correlation_id, 'fallback', buildFallbackCapture(request.url, error), { pipelineVersion: 'capture-v5-intake-only' });
        return { status: 'degraded', captureQuality: 'degraded', postId: finalization.post_id, outboxEventId: null };
    }

    // Finalization failures must bubble to the worker retry path; never overwrite
    // successfully extracted source data with a fallback capture.
    const finalization = await finalizer(request.user_id, request.correlation_id, result.source, result.data, { pipelineVersion: 'capture-v5-intake-only' });
    return { status: 'finalized', captureQuality: 'complete', postId: finalization.post_id, outboxEventId: null };
}
