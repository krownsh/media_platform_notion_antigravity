import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

/**
 * Social Media Service
 * Handles publishing content to Instagram, Threads, and Twitter (X).
 */
export const socialMediaService = {

    /**
     * Publish to Instagram (Business Account)
     * Requires: Instagram Business Account linked to Facebook Page.
     * 
     * @param {string} imageUrl - Public URL of the image to post
     * @param {string} caption - Caption for the post
     * @param {string} accessToken - User's Long-lived Page Access Token
     * @param {string} instagramAccountId - The Instagram Business Account ID
     */
    async publishToInstagram(imageUrl, caption, accessToken, instagramAccountId) {
        console.log('[Social] Publishing to Instagram...');

        if (!accessToken || !instagramAccountId) {
            throw new Error('Missing Instagram credentials (accessToken or accountId)');
        }

        try {
            // Step 1: Create Media Container
            const containerUrl = `https://graph.facebook.com/v18.0/${instagramAccountId}/media`;
            const containerRes = await fetch(containerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_url: imageUrl,
                    caption: caption,
                    access_token: accessToken
                })
            });

            const containerData = await containerRes.json();
            if (containerData.error) throw new Error(containerData.error.message);

            const creationId = containerData.id;
            console.log(`[Social] IG Container Created: ${creationId}`);

            // Step 2: Publish Media
            // Note: For images, we can usually publish immediately. For videos, we might need to check status.
            const publishUrl = `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`;
            const publishRes = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: creationId,
                    access_token: accessToken
                })
            });

            const publishData = await publishRes.json();
            if (publishData.error) throw new Error(publishData.error.message);

            console.log(`[Social] IG Published: ${publishData.id}`);
            return { platform: 'instagram', id: publishData.id, url: `https://instagram.com/p/${publishData.id}` }; // URL is a guess, API doesn't return permalink directly usually
        } catch (error) {
            console.error('[Social] Instagram Error:', error);
            throw error;
        }
    },

    /**
     * Publish to Threads
     * Requires: Threads API Access
     * 
     * @param {string} imageUrl - Public URL of the image to post (optional)
     * @param {string} text - Text content
     * @param {string} accessToken - Threads User Access Token
     * @param {string} threadsUserId - Threads User ID
     */
    async publishToThreads(imageUrl, text, accessToken, threadsUserId) {
        console.log('[Social] Publishing to Threads...');

        if (!accessToken || !threadsUserId) {
            throw new Error('Missing Threads credentials (accessToken or userId)');
        }

        try {
            // Step 1: Create Media Container
            const containerUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads`;
            const payload = {
                media_type: imageUrl ? 'IMAGE' : 'TEXT',
                text: text,
                access_token: accessToken
            };

            if (imageUrl) {
                payload.image_url = imageUrl;
            }

            const containerRes = await fetch(containerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const containerData = await containerRes.json();
            if (containerData.error) throw new Error(containerData.error.message);

            const creationId = containerData.id;
            console.log(`[Social] Threads Container Created: ${creationId}`);

            // Step 2: Publish
            const publishUrl = `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`;
            const publishRes = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: creationId,
                    access_token: accessToken
                })
            });

            const publishData = await publishRes.json();
            if (publishData.error) throw new Error(publishData.error.message);

            console.log(`[Social] Threads Published: ${publishData.id}`);
            return { platform: 'threads', id: publishData.id };
        } catch (error) {
            console.error('[Social] Threads Error:', error);
            throw error;
        }
    },

    /**
     * Publish to Twitter (X)
     * Note: This implementation assumes v2 API.
     * Media upload is complex in v2 without a library. 
     * For now, we will implement TEXT ONLY or External Image URL if supported by card.
     * To upload native media, we would need OAuth 1.0a signing for v1.1 media/upload endpoint.
     * 
     * @param {string} text - Text content
     * @param {string} accessToken - OAuth 2.0 Access Token (Bearer)
     */
    async publishToTwitter(text, accessToken) {
        console.log('[Social] Publishing to Twitter...');

        if (!accessToken) {
            throw new Error('Missing Twitter Access Token');
        }

        try {
            const url = 'https://api.twitter.com/2/tweets';
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text
                })
            });

            const data = await res.json();
            if (data.errors) throw new Error(data.errors[0].message);

            console.log(`[Social] Twitter Published: ${data.data.id}`);
            return { platform: 'twitter', id: data.data.id };
        } catch (error) {
            console.error('[Social] Twitter Error:', error);
            throw error;
        }
    }
};
