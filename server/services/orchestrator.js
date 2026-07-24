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
 * 4. Return normalized data without changing the /api/process contract.
 * 5. The API finalizes database state through one transactional RPC.
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

    async processUrl(url) {
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
                return { source: 'crawler', data };
            } else {
                throw new Error(`Failed to fetch post: ${data.error}`);
            }
        });
    }
}

export const orchestrator = new Orchestrator();
