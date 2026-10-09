import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import { refreshOwnerPostSearchDocument } from './ownerSearchService.js';
import { prepareInitialReviewProposals } from './reviewProposalService.js';
import { createOrRetryLocalPostCaseFile } from './localMediaKnowledgeWorkflowService.js';

function normalizeCommentTimestamp(value) {
    const timestamp = value ? new Date(value) : new Date();
    return Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
}

export function normalizeCapturePlatform(platform) {
    const supportedPlatforms = new Set([
        'instagram', 'facebook', 'twitter', 'threads', 'generic', 'notion', 'youtube', 'github', 'image'
    ]);
    return supportedPlatforms.has(platform) ? platform : 'generic';
}

export async function finalizeCapture(
    userId,
    correlationId,
    source,
    data,
    {
        supabaseClient = supabase,
        configured = isSupabaseConfigured,
        pipelineVersion = 'capture-v5-owner-guided',
        captureQuality = 'complete',
        reviewPreparer = prepareInitialReviewProposals,
        searchIndexer = refreshOwnerPostSearchDocument,
        localNoteWriter = createOrRetryLocalPostCaseFile
    } = {}
) {
    if (!configured) {
        const error = new Error('Supabase service client is not configured');
        error.code = 'DATABASE_NOT_CONFIGURED';
        throw error;
    }

    const originalUrl = data.original_url || data.originalUrl || data.url;
    if (!originalUrl) throw new Error('Capture is missing original_url');

    const { data: finalized, error } = await supabaseClient
        .rpc('finalize_collection_capture', {
            p_user_id: userId,
            p_correlation_id: correlationId,
            p_pipeline_version: pipelineVersion,
            p_capture_quality: captureQuality,
            p_post: {
                platform: normalizeCapturePlatform(data.platform),
                original_url: originalUrl,
                title: data.title || null,
                author_name: data.author || data.author_name || null,
                author_id: data.authorHandle || data.author_id || null,
                author_avatar_url: null,
                content: data.content || null,
                posted_at: data.posted_at || data.postedAt || null,
                is_archived: data.is_archived ?? false,
                full_json: data.full_json || data.fullJson || null,
                source_domains: data.source_domains || [],
                source_type: data.source_type
                    || data.full_json?.source_type
                    || data.fullJson?.source_type
                    || (source === 'fallback' ? 'fallback_link' : source === 'upload' ? 'image_upload' : 'url_capture')
            },
            p_analysis: {},
            p_media: (data.images || []).map((media, index) => {
                if (typeof media === 'string') return { url: media, order: index };
                return {
                    url: media.url,
                    order: media.order ?? index,
                    storage_bucket: media.storage_bucket || null,
                    storage_path: media.storage_path || null,
                    content_type: media.content_type || null,
                    byte_size: media.byte_size ?? null,
                    original_filename: media.original_filename || null
                };
            }),
            p_comments: (data.comments || []).map((comment) => ({
                author_name: comment.user || comment.author || null,
                content: comment.text || comment.content || null,
                commented_at: normalizeCommentTimestamp(comment.postedAt || comment.commented_at),
                raw_data: comment
            }))
        })
        .single();

    if (error) throw new Error(`Capture finalization failed: ${error.message}`);
    if (!finalized?.post_id || !finalized?.source_revision_id) {
        throw new Error('Capture finalization returned an incomplete result');
    }

    try {
        await reviewPreparer({
            userId,
            sourceRevisionId: finalized.source_revision_id,
            supabaseClient
        });
    } catch (packetError) {
        console.warn(`[Capture] Review packet projection deferred: ${packetError.message}`);
    }

    try {
        await searchIndexer({ userId, postId: finalized.post_id, sourceRevisionId: finalized.source_revision_id, supabaseClient });
    } catch (error) {
        console.warn(`[Capture] Search projection deferred: ${error.message}`);
    }

    try {
        await localNoteWriter({ userId, postId: finalized.post_id });
    } catch (error) {
        console.warn(`[Capture] Local case-file delivery deferred: ${error.message}`);
    }

    return finalized;
}
