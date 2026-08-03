import { IMAGE_CAPTURE_BUCKET } from './imageCaptureService.js';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

function isOwnedPrivateCaptureMedia(post, media) {
    const userId = typeof post?.user_id === 'string' ? post.user_id : '';
    const expectedPrefix = `${userId}/captures/`;
    return media?.storage_bucket === IMAGE_CAPTURE_BUCKET
        && typeof media?.storage_path === 'string'
        && Boolean(userId)
        && media.storage_path.startsWith(expectedPrefix);
}

export async function resolveStoredMediaUrls(posts, supabaseClient, expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS) {
    const list = Array.isArray(posts) ? posts : [];
    const groups = new Map();

    for (const post of list) {
        for (const media of post.collection_post_media || []) {
            if (!isOwnedPrivateCaptureMedia(post, media)) continue;
            const paths = groups.get(media.storage_bucket) || new Set();
            paths.add(media.storage_path);
            groups.set(media.storage_bucket, paths);
        }
    }

    const signedByStorageKey = new Map();
    await Promise.all([...groups.entries()].map(async ([bucket, pathSet]) => {
        const paths = [...pathSet];
        const { data, error } = await supabaseClient.storage
            .from(bucket)
            .createSignedUrls(paths, expiresIn);
        if (error) {
            console.warn(`[Media] Failed to sign ${bucket} URLs: ${error.message}`);
            return;
        }
        for (const item of data || []) {
            if (item?.path && item?.signedUrl) {
                signedByStorageKey.set(`${bucket}:${item.path}`, item.signedUrl);
            }
        }
    }));

    return list.map((post) => ({
        ...post,
        collection_post_media: (post.collection_post_media || []).map((media) => {
            if (!media.storage_bucket || !media.storage_path) return media;
            if (!isOwnedPrivateCaptureMedia(post, media)) return { ...media, url: null };
            return {
                ...media,
                url: signedByStorageKey.get(`${media.storage_bucket}:${media.storage_path}`) || null
            };
        })
    }));
}
