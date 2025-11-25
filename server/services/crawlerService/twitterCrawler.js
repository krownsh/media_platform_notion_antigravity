
/**
 * Scrapes a Twitter (X) post using the internal API.
 * @param {string} url 
 * @returns {Promise<Object>} Scraped post data
 */
export async function scrapeTwitterPost(url) {
    console.log(`[TwitterCrawler] 🕷️ Starting scrape for: ${url}`);

    try {
        const tweetId = getTweetId(url);
        if (!tweetId) {
            throw new Error('Invalid Twitter URL');
        }

        // 1. Get Guest Token
        const guestToken = await getGuestToken();
        console.log(`[TwitterCrawler] Got guest token: ${guestToken}`);

        // 2. Call GraphQL API
        const data = await fetchTweetData(tweetId, guestToken);

        // 3. Parse Data
        const result = data.data.tweetResult.result;
        if (!result) {
            throw new Error('Tweet not found or unavailable');
        }

        // Handle "TweetUnavailable" or other types if necessary
        if (result.__typename === 'TweetUnavailable') {
            throw new Error('Tweet is unavailable');
        }

        const legacy = result.legacy;
        const core = result.core;
        const userCore = core.user_results.result.core;
        const userLegacy = core.user_results.result.legacy;

        // Extract content
        let content = legacy.full_text;

        // Replace t.co URLs with expanded URLs
        if (legacy.entities && legacy.entities.urls) {
            legacy.entities.urls.forEach(urlEntity => {
                if (urlEntity.url && urlEntity.expanded_url) {
                    content = content.replace(urlEntity.url, urlEntity.expanded_url);
                }
            });
        }

        // Extract author info
        // Try to get from core.user_results.result.legacy first as it seems more reliable in some responses
        // Fallback to core.user_results.result.core if needed
        const author = userLegacy.name || (userCore && userCore.name);
        const authorHandle = userLegacy.screen_name || (userCore && userCore.screen_name);
        const avatar = userLegacy.profile_image_url_https || userLegacy.profile_image_url;
        const postedAt = legacy.created_at; // "Wed Nov 12 10:45:54 +0000 2025"

        // Extract images/media
        let images = [];

        // Check for media entities
        if (legacy.entities && legacy.entities.media) {
            images = legacy.entities.media.map(m => m.media_url_https);
        }

        // Check for card images (if any) - as seen in the doc example for link previews
        // The doc example shows a card with binding_values
        if (result.card && result.card.legacy && result.card.legacy.binding_values) {
            const bindings = result.card.legacy.binding_values;
            // Try to find large image
            const photoLarge = bindings.find(b => b.key === 'photo_image_full_size_large');
            if (photoLarge && photoLarge.value && photoLarge.value.image_value) {
                images.push(photoLarge.value.image_value.url);
            } else {
                // Try other keys if needed, e.g., thumbnail_image_original
                const thumbnailOriginal = bindings.find(b => b.key === 'thumbnail_image_original');
                if (thumbnailOriginal && thumbnailOriginal.value && thumbnailOriginal.value.image_value) {
                    images.push(thumbnailOriginal.value.image_value.url);
                }
            }
        }

        // Deduplicate images
        images = [...new Set(images)];

        // Construct Full JSON for AI
        const fullJsonData = [
            {
                main_text: content,
                author: author,
                postedAt: postedAt,
                images: images,
                replies: [] // API response in doc doesn't include replies
            }
        ];

        const finalData = {
            platform: 'twitter',
            originalUrl: url,
            original_url: url,
            scrapedAt: new Date().toISOString(),

            author: author,
            authorHandle: authorHandle,
            avatar: avatar,
            postedAt: postedAt,
            posted_at: postedAt,

            content: content,

            images: images,
            videos: [], // TODO: Add video support if needed
            comments: [], // Comments require login to fetch, so we leave them empty for guest access

            full_json: fullJsonData,

            raw: data // Store raw response for debugging
        };

        console.log('[TwitterCrawler] Scrape successful');
        return finalData;

    } catch (error) {
        console.error(`[TwitterCrawler] ❌ Failed: ${error.message}`);
        throw error;
    }
}

function getTweetId(url) {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
}

async function getGuestToken() {
    const response = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to get guest token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.guest_token;
}

async function fetchTweetData(tweetId, guestToken) {
    const variables = {
        "tweetId": tweetId,
        "includePromotedContent": true,
        "withBirdwatchNotes": true,
        "withVoice": true,
        "withCommunity": true
    };

    const features = {
        "creator_subscriptions_tweet_preview_api_enabled": true,
        "premium_content_api_read_enabled": false,
        "communities_web_enable_tweet_community_results_fetch": true,
        "c9s_tweet_anatomy_moderator_badge_enabled": true,
        "responsive_web_grok_analyze_button_fetch_trends_enabled": false,
        "responsive_web_grok_analyze_post_followups_enabled": false,
        "responsive_web_jetfuel_frame": true,
        "responsive_web_grok_share_attachment_enabled": true,
        "articles_preview_enabled": true,
        "responsive_web_edit_tweet_api_enabled": true,
        "graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
        "view_counts_everywhere_api_enabled": true,
        "longform_notetweets_consumption_enabled": true,
        "responsive_web_twitter_article_tweet_consumption_enabled": true,
        "tweet_awards_web_tipping_enabled": false,
        "responsive_web_grok_show_grok_translated_post": false,
        "responsive_web_grok_analysis_button_from_backend": true,
        "creator_subscriptions_quote_tweet_preview_enabled": false,
        "freedom_of_speech_not_reach_fetch_enabled": true,
        "standardized_nudges_misinfo": true,
        "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
        "longform_notetweets_rich_text_read_enabled": true,
        "longform_notetweets_inline_media_enabled": true,
        "profile_label_improvements_pcf_label_in_post_enabled": true,
        "responsive_web_profile_redirect_enabled": false,
        "rweb_tipjar_consumption_enabled": true,
        "verified_phone_label_enabled": false,
        "responsive_web_grok_image_annotation_enabled": true,
        "responsive_web_grok_imagine_annotation_enabled": true,
        "responsive_web_grok_community_note_auto_translation_is_enabled": false,
        "responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
        "responsive_web_graphql_timeline_navigation_enabled": true,
        "responsive_web_enhance_cards_enabled": false
    };

    const fieldToggles = {
        "withArticleRichContentState": true,
        "withArticlePlainText": false
    };

    const queryId = 'kLXoXTloWpv9d2FSXRg-Tg';
    const baseUrl = `https://api.x.com/graphql/${queryId}/TweetResultByRestId`;

    const url = new URL(baseUrl);
    url.searchParams.append('variables', JSON.stringify(variables));
    url.searchParams.append('features', JSON.stringify(features));
    url.searchParams.append('fieldToggles', JSON.stringify(fieldToggles));

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
            'x-guest-token': guestToken,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch tweet data: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}
