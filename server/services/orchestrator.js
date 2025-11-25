import { socialApiService } from './socialApiService.js';
import { crawlerService } from './crawlerService/browser.js';
import { scrapeThreadsPost } from './crawlerService/threadsCrawler.js';
import { scrapeTwitterPost } from './crawlerService/twitterCrawler.js';
import { supabase } from '../supabaseClient.js'; // corrected relative path

/**
 * Orchestrator
 * The central brain that coordinates data acquisition.
 *
 * Logic:
 * 1. Identify Platform.
 * 2. Try API (SocialApiService).
 * 3. If API fails or returns partial data, use Crawler (CrawlerService).
 * 4. Store full_json into posts table (if present).
 * 5. Return normalized data.
 */
class Orchestrator {
    // Identify platform based on URL
    identifyPlatform(url) {
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
        if (url.includes('threads.net') || url.includes('threads.com')) return 'threads';
        return 'unknown';
    }

    // Helper: upsert post with full_json (if present)
    async upsertPost(data) {
        if (!data) return;
        const fallbackUserId = process.env.SUPABASE_SYSTEM_USER_ID || null;
        const originalUrl = data.original_url || data.originalUrl || data.originalURL || data.url;
        const postedAt = data.posted_at || data.postedAt || null;
        const fullJson = data.full_json || data.fullJson;
        const userId = data.user_id || data.owner_id || fallbackUserId;

        if (!originalUrl) {
            console.warn('[Orchestrator] Missing original_url, skipping upsert');
            return;
        }

        if (!userId) {
            console.warn('[Orchestrator] Missing user_id (and no SUPABASE_SYSTEM_USER_ID set), skipping DB persist to avoid FK errors');
            return;
        }

        const upsertPayload = {
            ...(data.id && { id: data.id }),
            user_id: userId,
            platform: data.platform,
            original_url: originalUrl,
            title: data.title,
            content: data.content,
            posted_at: postedAt || null,
            is_archived: data.is_archived ?? false,
            full_json: fullJson || null,
        };
        // Remove undefined keys (Supabase will reject them for NOT NULL columns)
        Object.keys(upsertPayload).forEach(k => upsertPayload[k] === undefined && delete upsertPayload[k]);
        try {
            const conflictKey = data.id ? 'id' : 'original_url';
            let { error } = await supabase.from('posts').upsert(upsertPayload, { onConflict: conflictKey }).select();

            // Retry without custom conflict key if the DB lacks the expected unique constraint
            if (error && conflictKey === 'original_url' && /unique|exclusion|on conflict/i.test(error.message)) {
                console.warn('[Orchestrator] original_url upsert failed, retrying with primary key:', error.message);
                ({ error } = await supabase.from('posts').upsert(upsertPayload).select());
            }

            if (error) console.warn('[Orchestrator] Failed to upsert post full_json:', error.message);
        } catch (e) {
            console.warn('[Orchestrator] Exception during upsert:', e.message);
        }
    }

    // Helper: Upload image to Supabase Storage
    async uploadImageToBucket(url) {
        try {
            // Skip if already a Supabase URL
            if (url.includes('supabase.co')) return url;

            console.log(`[Orchestrator] Uploading image to bucket: ${url}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

            const buffer = await response.arrayBuffer();
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const extension = contentType.split('/')[1] || 'jpg';
            const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
            const filePath = `threads_images/${filename}`;

            // Upload to 'post_images' bucket (assuming it exists)
            const { error } = await supabase.storage
                .from('post_images')
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
                .from('post_images')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (error) {
            console.warn(`[Orchestrator] Image processing failed: ${error.message}`);
            return url; // Fallback to original URL
        }
    }

    async processUrl(url) {
        const platform = this.identifyPlatform(url);
        if (platform === 'unknown') {
            throw new Error('Unknown platform');
        }

        // Auto‑correct threads.com to threads.net
        if (platform === 'threads' && url.includes('threads.com')) {
            url = url.replace('threads.com', 'threads.net');
        }

        console.log(`[Orchestrator] Processing ${platform} URL: ${url}`);

        // Special handling for Threads (Direct Crawler)
        if (platform === 'threads') {
            console.log('[Orchestrator] Using specialized Threads Crawler...');
            try {
                let data = await scrapeThreadsPost(url);

                // Upload Images to Bucket
                if (data.images && data.images.length > 0) {
                    console.log('[Orchestrator] Processing images...');
                    const newImages = [];
                    for (const imgUrl of data.images) {
                        const newUrl = await this.uploadImageToBucket(imgUrl);
                        newImages.push(newUrl);
                    }
                    data.images = newImages;

                    // Update images in full_json
                    if (data.full_json && Array.isArray(data.full_json) && data.full_json[0]) {
                        data.full_json[0].images = data.images;
                    }
                }

                await this.upsertPost(data);
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

                // Upload Images to Bucket
                if (data.images && data.images.length > 0) {
                    console.log('[Orchestrator] Processing images...');
                    const newImages = [];
                    for (const imgUrl of data.images) {
                        const newUrl = await this.uploadImageToBucket(imgUrl);
                        newImages.push(newUrl);
                    }
                    data.images = newImages;

                    // Update images in full_json
                    if (data.full_json && Array.isArray(data.full_json) && data.full_json[0]) {
                        data.full_json[0].images = data.images;
                    }
                }

                await this.upsertPost(data);
                return { source: 'crawler', data };
            } catch (error) {
                throw new Error(`Twitter Crawler failed: ${error.message}`);
            }
        }

        // 1. Try API First (For other platforms)
        let data = await socialApiService.fetchPost(platform, url);

        if (data) {
            console.log('[Orchestrator] Data fetched via API.');
            await this.upsertPost(data);
            return { source: 'api', data };
        }

        // 2. Fallback to Crawler
        console.log('[Orchestrator] API failed or not configured. Switching to Crawler...');
        data = await crawlerService.crawlPost(url, platform);

        if (data.success) {
            console.log('[Orchestrator] Data fetched via Crawler.');
            await this.upsertPost(data);
            return { source: 'crawler', data };
        } else {
            throw new Error(`Failed to fetch post: ${data.error}`);
        }
    }
}

export const orchestrator = new Orchestrator();
