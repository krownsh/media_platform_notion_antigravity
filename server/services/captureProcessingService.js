import { orchestrator } from './orchestrator.js';
import { finalizeCapture } from './captureFinalizationService.js';

export function isCoreCaptureUrl(url) {
    return /(^|\.)threads\.(net|com)$|(^|\.)(twitter\.com|x\.com)$/i.test(new URL(url).hostname);
}

export function buildFallbackCapture(url, error) {
    return {
        platform: 'generic',
        original_url: url,
        title: '連結存檔 (自動容錯)',
        content: url,
        analysis: {
            primary_category: 'other',
            summary: `⚠️ 此網址目前無法解析詳細內容，已自動轉為連結存檔模式。\n原因：${error.message}`
        }
    };
}

export function buildImageCapture(request) {
    if (!request.storage_bucket || !request.storage_path || !request.media_content_type) {
        throw new Error('Image capture is missing persisted storage metadata');
    }

    const storageUrl = `storage://${request.storage_bucket}/${request.storage_path}`;
    return {
        source_type: 'image_upload',
        platform: 'image',
        original_url: storageUrl,
        title: request.original_filename || '圖片上傳',
        author: '圖片上傳',
        authorHandle: null,
        content: null,
        full_json: {
            source_type: 'image_upload',
            storage: {
                bucket: request.storage_bucket,
                path: request.storage_path,
                content_type: request.media_content_type,
                size_bytes: request.media_size_bytes,
                original_filename: request.original_filename || null
            }
        },
        images: [{
            url: storageUrl,
            storage_bucket: request.storage_bucket,
            storage_path: request.storage_path,
            content_type: request.media_content_type,
            byte_size: request.media_size_bytes,
            original_filename: request.original_filename || null
        }],
        analysis: { primary_category: 'other' }
    };
}

export async function processCaptureRequest(
    request,
    { acquisition = orchestrator, finalizer = finalizeCapture } = {}
) {
    if (request.input_type === 'image') {
        const imageCapture = buildImageCapture(request);
        const finalization = await finalizer(
            request.user_id,
            request.correlation_id,
            'upload',
            imageCapture,
            { pipelineVersion: 'capture-v4-image-async' }
        );

        return {
            status: 'finalized',
            captureQuality: 'complete',
            postId: finalization.post_id,
            outboxEventId: finalization.outbox_event_id
        };
    }

    let result;
    try {
        result = await acquisition.processUrl(request.url);
        if (!result?.data) throw new Error('Crawler returned no normalized data');
    } catch (error) {
        if (isCoreCaptureUrl(request.url)) throw error;

        const fallback = buildFallbackCapture(request.url, error);
        const finalization = await finalizer(
            request.user_id,
            request.correlation_id,
            'fallback',
            fallback,
            { pipelineVersion: 'capture-v3-async' }
        );

        return {
            status: 'degraded',
            captureQuality: 'degraded',
            postId: finalization.post_id,
            outboxEventId: finalization.outbox_event_id
        };
    }

    // Hermes owns AI triage. The capture worker only persists source data.
    result.data.analysis = result.data.analysis || { primary_category: 'other' };
    const finalization = await finalizer(
        request.user_id,
        request.correlation_id,
        result.source,
        result.data,
        { pipelineVersion: 'capture-v3-async' }
    );

    return {
        status: 'finalized',
        captureQuality: 'complete',
        postId: finalization.post_id,
        outboxEventId: finalization.outbox_event_id
    };
}
