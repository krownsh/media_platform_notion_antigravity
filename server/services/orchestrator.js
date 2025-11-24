import { socialApiService } from './socialApiService.js';
import { crawlerService } from './crawlerService/browser.js';
import { scrapeThreadsPost } from './crawlerService/threadsCrawler.js';
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
                const data = await scrapeThreadsPost(url);
                await this.upsertPost(data);
                return { source: 'crawler', data };
            } catch (error) {
                throw new Error(`Threads Crawler failed: ${error.message}`);
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
