import { socialApiService } from './socialApiService.js';
import { crawlerService } from './crawlerService/browser.js';

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
        if (url.includes('threads.net')) return 'threads';
        return 'unknown';
    }

    async processUrl(url) {
        const platform = this.identifyPlatform(url);
        if (platform === 'unknown') {
            throw new Error('Unknown platform');
        }

        console.log(`[Orchestrator] Processing ${platform} URL: ${url}`);

        // 1. Try API First
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
