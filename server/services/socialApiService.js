/**
 * Social API Service
 * Handles interactions with official APIs (Instagram, Facebook, Twitter/X, Threads).
 * 
 * Responsibilities:
 * - Fetch post data using official APIs.
 * - Handle authentication and rate limiting.
 * - Normalize data into a UnifiedPostObject.
 */

class SocialApiService {
    constructor() {
        // Initialize API clients here (e.g., FB SDK, Twitter Client)
        this.apiKeys = {
            instagram: process.env.INSTAGRAM_ACCESS_TOKEN,
            facebook: process.env.FACEBOOK_ACCESS_TOKEN,
            twitter: process.env.TWITTER_BEARER_TOKEN,
        };
    }

    /**
     * Main entry point to fetch a post via API.
     * @param {string} platform - 'instagram', 'facebook', 'twitter', 'threads'
     * @param {string} url - The original post URL
     * @returns {Promise<object|null>} - UnifiedPostObject or null if failed/fallback needed
     */
    async fetchPost(platform, url) {
        console.log(`[SocialApiService] Attempting to fetch ${platform} post: ${url}`);

        try {
            switch (platform) {
                case 'instagram':
                    return await this.fetchInstagram(url);
                case 'facebook':
                    return await this.fetchFacebook(url);
                case 'twitter':
                case 'x':
                    return await this.fetchTwitter(url);
                case 'threads':
                    return await this.fetchThreads(url);
                default:
                    throw new Error(`Unsupported platform for API: ${platform}`);
            }
        } catch (error) {
            console.warn(`[SocialApiService] API fetch failed for ${platform}: ${error.message}`);
            return null; // Return null to trigger fallback to Crawler
        }
    }

    async fetchInstagram(_url) {
        // TODO: Implement Instagram Graph API logic
        // 1. Extract Shortcode from URL
        // 2. Call /media endpoint
        // 3. Return normalized object

        // Mock implementation for now
        if (!this.apiKeys.instagram) {
            throw new Error('Missing Instagram Access Token');
        }
        return null;
    }

    async fetchFacebook(_url) {
        // TODO: Implement Facebook Graph API
        return null;
    }

    async fetchTwitter(_url) {
        // TODO: Implement Twitter v2 API
        return null;
    }

    async fetchThreads(_url) {
        // TODO: Implement Threads API (if available)
        return null;
    }
}

export const socialApiService = new SocialApiService();
