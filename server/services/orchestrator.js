import { socialApiService } from './socialApiService.js';
import { crawlerService } from './crawlerService/browser.js';
import { scrapeThreadsPost } from './crawlerService/threadsCrawler.js';

/**
 * Orchestrator
 * The central brain that coordinates data acquisition.
 * 
 * Logic:
 * 1. Identify Platform.
 * 2. Try API (SocialApiService).
 * 3. If API fails or returns partial data, use Crawler (CrawlerService).
 * 4. Return normalized data.
 */
class Orchestrator {

    identifyPlatform(url) {
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
        if (url.includes('threads.net') || url.includes('threads.com')) return 'threads';
        return 'unknown';
    }

    async processUrl(url) {
        const platform = this.identifyPlatform(url);
        if (platform === 'unknown') {
            throw new Error('Unknown platform');
        }

        // Auto-correct threads.com to threads.net
        if (platform === 'threads' && url.includes('threads.com')) {
            url = url.replace('threads.com', 'threads.net');
        }

        console.log(`[Orchestrator] Processing ${platform} URL: ${url}`);

        // Special handling for Threads (Direct Crawler)
        if (platform === 'threads') {
            console.log('[Orchestrator] Using specialized Threads Crawler...');
            try {
                const data = await scrapeThreadsPost(url);
                return { source: 'crawler', data };
            } catch (error) {
                throw new Error(`Threads Crawler failed: ${error.message}`);
            }
        }

        // 1. Try API First (For other platforms)
        let data = await socialApiService.fetchPost(platform, url);

        if (data) {
            console.log('[Orchestrator] Data fetched via API.');
            return { source: 'api', data };
        }

        // 2. Fallback to Crawler
        console.log('[Orchestrator] API failed or not configured. Switching to Crawler...');
        data = await crawlerService.crawlPost(url, platform);

        if (data.success) {
            console.log('[Orchestrator] Data fetched via Crawler.');
            return { source: 'crawler', data };
        } else {
            throw new Error(`Failed to fetch post: ${data.error}`);
        }
    }
}

export const orchestrator = new Orchestrator();
