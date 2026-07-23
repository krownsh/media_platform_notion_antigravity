import { crawlerService } from './crawlerService/browser.js';
import { scrapeThreadsPost } from './crawlerService/threadsCrawler.js';
import { scrapeTwitterPost } from './crawlerService/twitterCrawler.js';
import { supabase } from '../supabaseClient.js';
import pLimit from 'p-limit';

// Global concurrency limiter (max 3 concurrent crawler tasks)
const limit = pLimit(3);

/**
 * Orchestrator
 * The central brain that coordinates data acquisition.
 *
 * Logic:
 * 1. Identify Platform.
 * 2. Use the platform-specific crawler when available.
 * 3. Otherwise use the generic Chromium crawler.
 * 4. Store full_json into posts table (if present).
 * 5. Return normalized data without changing the /api/process contract.
 */
class Orchestrator {
    // Identify platform based on URL
    identifyPlatform(url) {
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com')) return 'facebook';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
        if (url.includes('threads.net') || url.includes('threads.com')) return 'threads';
        if (url.includes('notion.so') || url.includes('notion.site')) return 'notion';
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('github.com')) return 'github';
        return 'generic';
    }

    // Helper: upsert post with full_json (if present)
    async upsertPost(data, userIdParam = null) {
        if (!data) return null;
        const fallbackUserId = process.env.SUPABASE_SYSTEM_USER_ID || null;
        const originalUrl = data.original_url || data.originalUrl || data.originalURL || data.url;
        const postedAt = data.posted_at || data.postedAt || null;
        const fullJson = data.full_json || data.fullJson;
        const userId = userIdParam || data.user_id || data.owner_id || fallbackUserId;

        if (!originalUrl) {
            console.warn('[Orchestrator] Missing original_url, skipping upsert');
            return null;
        }

        if (!userId) {
            console.warn('[Orchestrator] Missing user_id (and no SUPABASE_SYSTEM_USER_ID set), skipping DB persist to avoid FK errors');
            return null;
        }

        const upsertPayload = {
            ...(data.id && { id: data.id }),
            user_id: userId,
            platform: data.platform,
            original_url: originalUrl,
            author_name: data.author || data.author_name || null,
            author_id: data.authorHandle || data.author_id || null, // Check authorHandle first
            author_avatar_url: data.avatar || data.author_avatar_url || null,
            content: data.content,
            posted_at: postedAt || null,
            is_archived: data.is_archived ?? false,
            full_json: fullJson || null,
            source_domains: data.source_domains || [],
        };
        // Remove undefined keys (Supabase will reject them for NOT NULL columns)
        Object.keys(upsertPayload).forEach(k => upsertPayload[k] === undefined && delete upsertPayload[k]);
        try {
            // Priority: 1. data.id (if editing), 2. original_url (if unique)
            const conflictKey = (data.id && data.id.length > 20) ? 'id' : 'original_url';
            let { data: savedData, error } = await supabase.from('collection_posts').upsert(upsertPayload, { onConflict: conflictKey }).select();

            // Retry without custom conflict key if the DB lacks the expected unique constraint on original_url
            if (error && conflictKey === 'original_url' && /unique|exclusion|on conflict/i.test(error.message)) {
                console.warn('[Orchestrator] original_url upsert failed, attempting manual find-or-create...');

                // Manual check to avoid duplicates if unique index is missing
                const { data: existing } = await supabase.from('collection_posts').select('id').eq('original_url', originalUrl).limit(1);

                if (existing && existing.length > 0) {
                    // Update existing
                    ({ data: savedData, error } = await supabase.from('collection_posts').update(upsertPayload).eq('id', existing[0].id).select());
                } else {
                    // Insert new
                    ({ data: savedData, error } = await supabase.from('collection_posts').insert(upsertPayload).select());
                }
            }

            if (error) {
                console.warn('[Orchestrator] Failed to persist post:', error.message);
                return null;
            }
            return savedData ? savedData[0] : null;
        } catch (e) {
            console.warn('[Orchestrator] Exception during upsert:', e.message);
            return null;
        }
    }

    // Helper: Upload image to Supabase Storage
    async uploadImageToBucket(url) {
        try {
            if (!url || typeof url !== 'string') return url;
            // Skip if already a Supabase URL
            if (url.includes('supabase.co')) return url;

            // Staggering: Mimic human behavior with random delay (100ms - 300ms)
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

            console.log(`[Orchestrator] Uploading image to bucket: ${url.substring(0, 50)}...`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

            const buffer = await response.arrayBuffer();
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const extension = contentType.split('/')[1] || 'jpg';
            const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
            const filePath = `threads_images/${filename}`;

            // Upload to 'collection_post_images' bucket (assuming it exists)
            const { error } = await supabase.storage
                .from('collection_post_images')
                .upload(filePath, buffer, {
                    contentType: contentType,
                    upsert: false
                });

            if (error) {
                // If bucket doesn't exist or other error, log and return original
                console.warn(`[Orchestrator] Storage upload failed: ${error.message}`);
                return url;
            }

            // Get Public URL
            const { data: publicUrlData } = supabase.storage
                .from('collection_post_images')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (error) {
            console.warn(`[Orchestrator] Image processing failed: ${error.message}`);
            return url; // Fallback to original URL
        }
    }

    async processGenericImages(data) {
        if (!data) return;
        
        // Handle post images array
        if (data.images && data.images.length > 0) {
            data.images = await Promise.all(data.images.map(imgUrl => this.uploadImageToBucket(imgUrl)));
            // Sync with full_json
            if (data.full_json && typeof data.full_json === 'object') {
                if (Array.isArray(data.full_json) && data.full_json[0]) {
                    data.full_json[0].images = data.images;
                } else if (!Array.isArray(data.full_json)) {
                    data.full_json.images = data.images;
                }
            }
        }
        
        // Handle avatar
        if (data.avatar) {
            data.avatar = await this.uploadImageToBucket(data.avatar);
            if (data.full_json && !Array.isArray(data.full_json)) data.full_json.avatar = data.avatar;
        } else if (data.author_avatar_url) {
            data.author_avatar_url = await this.uploadImageToBucket(data.author_avatar_url);
            if (data.full_json && !Array.isArray(data.full_json)) data.full_json.author_avatar_url = data.author_avatar_url;
        }
    }

    async processUrl(url, userId = null) {
        return limit(async () => {
            const platform = this.identifyPlatform(url);

            // Auto‑correct threads.com to threads.net
            if (platform === 'threads' && url.includes('threads.com')) {
                url = url.replace('threads.com', 'threads.net');
            }

            console.log(`[Orchestrator] Processing ${platform} URL (queued): ${url}`);

            // Special handling for Threads (Direct Crawler)
            if (platform === 'threads') {
                console.log('[Orchestrator] Using specialized Threads Crawler...');
                try {
                    let data = await scrapeThreadsPost(url);

                    // Upload Images to Bucket
                    if (data.images && data.images.length > 0) {
                        data.images = await Promise.all(data.images.map(imgUrl => this.uploadImageToBucket(imgUrl)));
                        if (data.full_json && Array.isArray(data.full_json) && data.full_json[0]) {
                            data.full_json[0].images = data.images;
                        }
                    }

                    // Process images in replies
                    if (data.full_json && Array.isArray(data.full_json) && data.full_json[0] && data.full_json[0].replies) {
                        await Promise.all(data.full_json[0].replies.map(async (reply) => {
                            if (reply.images && reply.images.length > 0) {
                                reply.images = await Promise.all(reply.images.map(imgUrl => this.uploadImageToBucket(imgUrl)));
                            }
                        }));
                    }

                    const saved = await this.upsertPost(data, userId);
                    if (saved) data.dbId = saved.id;

                    return { source: 'crawler', data };
                } catch (error) {
                    throw new Error(`Threads Crawler failed: ${error.message}`);
                }
            }

            // Special handling for Twitter (Direct Crawler)
            if (platform === 'twitter') {
                console.log('[Orchestrator] Using specialized Twitter Crawler...');
                try {
                    let data = await scrapeTwitterPost(url);

                    if (data.images && data.images.length > 0) {
                        data.images = await Promise.all(data.images.map(imgUrl => this.uploadImageToBucket(imgUrl)));
                        if (data.full_json && Array.isArray(data.full_json) && data.full_json[0]) {
                            data.full_json[0].images = data.images;
                        }
                    }

                    const saved = await this.upsertPost(data, userId);
                    if (saved) data.dbId = saved.id;

                    return { source: 'crawler', data };
                } catch (error) {
                    throw new Error(`Twitter Crawler failed: ${error.message}`);
                }
            }

            // All remaining platforms use the generic Chromium crawler.
            // Keep the response contract unchanged because /api/process is also called by n8n.
            console.log(`[Orchestrator] Using generic crawler for ${platform}...`);
            const data = await crawlerService.crawlPost(url, platform);

            if (data.success) {
                console.log('[Orchestrator] Data fetched via Crawler.');
                await this.processGenericImages(data);
                const saved = await this.upsertPost(data, userId);
                if (saved) data.dbId = saved.id;
                return { source: 'crawler', data };
            } else {
                throw new Error(`Failed to fetch post: ${data.error}`);
            }
        });
    }
}

export const orchestrator = new Orchestrator();
