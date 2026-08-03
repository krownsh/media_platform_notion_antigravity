import { mkdir, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { IMAGE_CAPTURE_BUCKET, MAX_IMAGE_BYTES, validateImageUpload } from './imageCaptureService.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_TYPE_EXTENSIONS = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/gif', 'gif']
]);

function postFromEvent(event) {
    return Array.isArray(event?.collection_posts) ? event.collection_posts[0] : event?.collection_posts;
}

function assertSafePrivateMedia(event, media) {
    const post = postFromEvent(event);
    const extension = CONTENT_TYPE_EXTENSIONS.get(media?.content_type);
    const expectedPrefix = `${event.user_id}/captures/`;
    const objectName = media?.storage_path?.startsWith(expectedPrefix)
        ? media.storage_path.slice(expectedPrefix.length)
        : '';

    if (!post || post.user_id !== event.user_id || post.platform !== 'image') {
        throw new Error('Outbox item is not a tenant-matched direct image capture');
    }
    if (media?.storage_bucket !== IMAGE_CAPTURE_BUCKET
        || !/^[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(objectName)
        || !extension) {
        throw new Error('Image media is outside the allowlisted private capture storage');
    }
    if (!UUID_PATTERN.test(media.id)) {
        throw new Error('Image media identity is invalid');
    }

    return extension;
}

export async function materializeHermesMedia(
    outboxId,
    supabaseClient,
    { temporaryRoot = path.join(os.tmpdir(), 'media-platform-hermes') } = {}
) {
    if (!UUID_PATTERN.test(String(outboxId || ''))) {
        throw new Error('Outbox ID must be a UUID');
    }
    if (!supabaseClient?.from || !supabaseClient?.storage) {
        throw new Error('Configured Supabase service client is required');
    }

    const { data: event, error } = await supabaseClient
        .from('collection_capture_outbox')
        .select(`
            id,
            user_id,
            collection_posts (
                id,
                user_id,
                platform,
                collection_post_media (
                    id,
                    storage_bucket,
                    storage_path,
                    content_type,
                    byte_size,
                    original_filename
                )
            )
        `)
        .eq('id', outboxId)
        .single();

    if (error || !event) {
        throw new Error(`Unable to load Hermes media: ${error?.message || 'outbox item not found'}`);
    }

    const post = postFromEvent(event);
    const mediaItems = (post?.collection_post_media || []).filter((media) => media.storage_path);
    if (mediaItems.length === 0) throw new Error('Outbox item has no private image media');

    const outputDirectory = path.join(temporaryRoot, outboxId);
    await mkdir(outputDirectory, { recursive: true, mode: 0o700 });

    const files = [];
    for (const media of mediaItems) {
        const extension = assertSafePrivateMedia(event, media);
        const { data: blob, error: downloadError } = await supabaseClient.storage
            .from(media.storage_bucket)
            .download(media.storage_path);
        if (downloadError || !blob) {
            throw new Error(`Unable to download Hermes media: ${downloadError?.message || 'empty object'}`);
        }

        const buffer = Buffer.from(await blob.arrayBuffer());
        if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
            throw new Error('Downloaded Hermes media has an invalid size');
        }
        if (Number.isFinite(Number(media.byte_size)) && Number(media.byte_size) !== buffer.length) {
            throw new Error('Downloaded Hermes media size does not match its database record');
        }
        validateImageUpload(buffer, media.content_type, media.original_filename);

        const localPath = path.join(outputDirectory, `${media.id}.${extension}`);
        await writeFile(localPath, buffer, { mode: 0o600 });
        files.push({
            media_id: media.id,
            local_path: localPath,
            content_type: media.content_type,
            byte_size: buffer.length,
            original_filename: media.original_filename || null
        });
    }

    return {
        outbox_id: event.id,
        temporary_directory: outputDirectory,
        files
    };
}
