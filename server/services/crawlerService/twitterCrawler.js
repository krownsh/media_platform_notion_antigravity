
import { createHash } from 'node:crypto';

const X_ARTICLE_URL = /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/i\/article\/(\d+)/i;
const X_ARTICLE_ID = /^\d{10,}$/;

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
        console.log('[TwitterCrawler] Guest token acquired');

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

        const legacy = result.legacy || {};
        const core = result.core || {};

        // Extract content
        let content = legacy.full_text || "";

        // Replace t.co URLs with expanded URLs
        if (legacy.entities && legacy.entities.urls) {
            legacy.entities.urls.forEach(urlEntity => {
                if (urlEntity.url && urlEntity.expanded_url) {
                    content = content.replace(urlEntity.url, urlEntity.expanded_url);
                }
            });
        }

        // Extract author info
        // Twitter GraphQL structure can be complex. Try multiple paths for reliability.
        const userResult = core?.user_results?.result;
        const userLegacy = userResult?.legacy || {};
        const userCore = userResult?.core || {};

        const author = userLegacy.name || userCore.name || 'Unknown User';
        const authorHandle = userLegacy.screen_name || userCore.screen_name || 'unknown';
        const postedAt = legacy.created_at;

        // Extract images/media
        let images = [];

        // Check for media entities
        if (legacy.entities && legacy.entities.media) {
            images = legacy.entities.media.map(m => m.media_url_https);
        }

        // Check for card images (if any)
        if (result.card && result.card.legacy && result.card.legacy.binding_values) {
            const bindings = result.card.legacy.binding_values;
            const photoLarge = bindings.find(b => b.key === 'photo_image_full_size_large');
            if (photoLarge && photoLarge.value && photoLarge.value.image_value) {
                images.push(photoLarge.value.image_value.url);
            } else {
                const thumbnailOriginal = bindings.find(b => b.key === 'thumbnail_image_original');
                if (thumbnailOriginal && thumbnailOriginal.value && thumbnailOriginal.value.image_value) {
                    images.push(thumbnailOriginal.value.image_value.url);
                }
            }
        }

        // Deduplicate images
        images = [...new Set(images)];

        // Extract Links
        const extractedLinks = [];
        if (legacy.entities && legacy.entities.urls) {
            legacy.entities.urls.forEach(u => {
                if (u.expanded_url) extractedLinks.push(u.expanded_url);
            });
        }

        const nestedLongformSources = extractNestedLongformSources(result);
        const parentText = content;
        content = composeEvidenceBundleText(parentText, nestedLongformSources);
        const evidenceBundle = buildEvidenceBundle(nestedLongformSources);

        // Keep the existing array envelope so downstream readers that expect
        // full_json[0] remain compatible.
        const fullJsonData = [
            {
                parent_text: parentText,
                main_text: content,
                author: author,
                postedAt: postedAt,
                images: images,
                extracted_links: [...new Set([...extractedLinks, ...nestedLongformSources.map(source => source.canonical_url)])],
                replies: [],
                nested_longform_sources: nestedLongformSources,
                evidence_bundle: evidenceBundle
            }
        ];

        // Extract source domains
        const sourceDomains = [...new Set(
            extractedLinks
                .map(link => {
                    try { return new URL(link).hostname.replace('www.', ''); } catch { return null; }
                })
                .filter(Boolean)
        )];

        const finalData = {
            platform: 'twitter',
            originalUrl: url,
            original_url: url,
            scrapedAt: new Date().toISOString(),

            author: author,
            authorHandle: authorHandle,
            postedAt: postedAt,
            posted_at: postedAt,

            title: nestedLongformSources.find(source => source.title)?.title || null,
            content: content,

            images: images,
            videos: [],
            comments: [],

            full_json: fullJsonData,
            source_domains: sourceDomains,

            raw: data
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
    const appBearerToken = getTwitterPublicBearerToken();
    const response = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${appBearerToken}`,
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
    const appBearerToken = getTwitterPublicBearerToken();
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
        "withArticlePlainText": true
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
            'Authorization': `Bearer ${appBearerToken}`,
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

function getTwitterPublicBearerToken() {
    const token = process.env.TWITTER_PUBLIC_BEARER_TOKEN?.trim();
    if (!token) {
        throw new Error('TWITTER_PUBLIC_BEARER_TOKEN is not configured');
    }
    return token;
}

function nonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function articleIdFrom(value) {
    const text = nonEmptyString(value);
    return text && X_ARTICLE_ID.test(text) ? text : null;
}

function canonicalArticleUrl(article) {
    const strings = [];
    const visit = (value, depth = 0) => {
        if (depth > 4 || value == null) return;
        if (typeof value === 'string') {
            strings.push(value);
            return;
        }
        if (typeof value !== 'object') return;
        for (const child of Object.values(value)) visit(child, depth + 1);
    };
    visit(article);

    for (const value of strings) {
        const match = value.match(X_ARTICLE_URL);
        if (match) return `https://x.com/i/article/${match[1]}`;
    }

    const id = [article.rest_id, article.article_id, article.articleId, article.id]
        .map(articleIdFrom)
        .find(Boolean);
    return id ? `https://x.com/i/article/${id}` : null;
}

function articleBody(article) {
    const candidates = [
        article.plain_text,
        article.plainText,
        article.text,
        article.body,
        article.content,
        article.rich_text?.plain_text,
        article.rich_text?.text,
        article.richText?.plainText,
        article.richText?.text
    ];
    return candidates.map(nonEmptyString).find(Boolean) || null;
}

function articleTitle(article) {
    return [article.title, article.headline, article.article_title, article.articleTitle]
        .map(nonEmptyString)
        .find(Boolean) || null;
}

/**
 * Finds X Article-shaped objects nested in a TweetResult payload without
 * treating arbitrary external URLs as child sources. The bounded traversal
 * also makes the crawler safe against unexpectedly deep GraphQL payloads.
 */
export function extractNestedLongformSources(tweetResult) {
    const candidates = [];
    const visited = new WeakSet();
    const visit = (value, key = '', depth = 0) => {
        if (depth > 12 || value == null || typeof value !== 'object') return;
        if (visited.has(value)) return;
        visited.add(value);

        const articleLike = /article/i.test(key)
            || Object.hasOwn(value, 'plain_text')
            || Object.hasOwn(value, 'article_id')
            || Object.hasOwn(value, 'articleId');
        if (articleLike) {
            const canonicalUrl = canonicalArticleUrl(value);
            const title = articleTitle(value);
            const body = articleBody(value);
            if (canonicalUrl || title || body) candidates.push({ canonicalUrl, title, body });
        }

        for (const [childKey, child] of Object.entries(value)) visit(child, childKey, depth + 1);
    };
    visit(tweetResult);

    const unique = new Map();
    for (const candidate of candidates) {
        if (!candidate.canonicalUrl) continue;
        const existing = unique.get(candidate.canonicalUrl);
        if (!existing || (!existing.body && candidate.body)) unique.set(candidate.canonicalUrl, candidate);
    }

    return [...unique.values()].map(({ canonicalUrl, title, body }) => ({
        type: 'x_article',
        requested_url: canonicalUrl,
        canonical_url: canonicalUrl,
        capture_status: body ? 'captured' : 'partial',
        extraction_method: 'x_tweet_result_article_payload',
        title,
        content: body,
        missing_fields: body ? [] : ['content'],
        immutable_capture_revision: createHash('sha256')
            .update(JSON.stringify({ canonicalUrl, title, body }))
            .digest('hex')
    }));
}

export function buildEvidenceBundle(nestedLongformSources) {
    if (!nestedLongformSources.length) return { status: 'no_nested_longform_found', sources: [] };
    const isComplete = nestedLongformSources.every(source => source.capture_status === 'captured');
    return {
        status: isComplete ? 'nested_longform_captured' : 'nested_longform_partial',
        sources: nestedLongformSources.map(source => ({
            canonical_url: source.canonical_url,
            capture_status: source.capture_status,
            missing_fields: source.missing_fields
        }))
    };
}

export function composeEvidenceBundleText(parentText, nestedLongformSources) {
    const capturedArticles = nestedLongformSources.filter(source => source.capture_status === 'captured' && source.content);
    if (!capturedArticles.length) return parentText;
    return [
        parentText,
        ...capturedArticles.map(source => `\n\n[Linked X Article: ${source.title || source.canonical_url}]\n${source.content}`)
    ].filter(Boolean).join('');
}

export function captureQualityForTwitterData(data) {
    const evidence = Array.isArray(data?.full_json) ? data.full_json[0]?.evidence_bundle : data?.full_json?.evidence_bundle;
    return evidence?.status === 'nested_longform_partial' || evidence?.status === 'nested_longform_failed'
        ? 'partial'
        : 'complete';
}

function twitterEvidenceEnvelope(data) {
    if (Array.isArray(data?.full_json) && data.full_json[0]) return data.full_json[0];
    return data?.full_json || null;
}

function refreshNestedEvidence(data) {
    const envelope = twitterEvidenceEnvelope(data);
    if (!envelope) return data;
    const sources = envelope.nested_longform_sources || [];
    const hasFailure = sources.some(source => source.capture_status === 'failed');
    envelope.evidence_bundle = {
        ...buildEvidenceBundle(sources),
        status: hasFailure ? 'nested_longform_failed' : buildEvidenceBundle(sources).status
    };
    data.content = composeEvidenceBundleText(envelope.parent_text || envelope.main_text, sources);
    envelope.main_text = data.content;
    return data;
}

/**
 * Enriches a discovered Article with a second, canonical page capture. This
 * stays inside the parent evidence bundle and leaves unrelated outbound links
 * untouched.
 */
export function applyNestedTwitterArticleCapture(data, canonicalUrl, articleCapture) {
    const envelope = twitterEvidenceEnvelope(data);
    const source = envelope?.nested_longform_sources?.find(item => item.canonical_url === canonicalUrl);
    const content = nonEmptyString(articleCapture?.content);
    if (!source || !content || content.length < 20) return data;

    source.capture_status = 'captured';
    source.content = content;
    source.title = nonEmptyString(articleCapture.title) || source.title;
    source.final_url = nonEmptyString(articleCapture.original_url) || canonicalUrl;
    source.extraction_method = 'x_article_canonical_page';
    source.missing_fields = [];
    source.immutable_capture_revision = createHash('sha256')
        .update(JSON.stringify({ canonicalUrl, title: source.title, body: source.content }))
        .digest('hex');
    if (Array.isArray(articleCapture.images)) {
        data.images = [...new Set([...(data.images || []), ...articleCapture.images])];
    }
    if (!data.title && source.title) data.title = source.title;
    return refreshNestedEvidence(data);
}

export function recordNestedTwitterArticleFailure(data, canonicalUrl, error) {
    const envelope = twitterEvidenceEnvelope(data);
    const source = envelope?.nested_longform_sources?.find(item => item.canonical_url === canonicalUrl);
    if (!source) return data;
    source.capture_status = 'failed';
    source.missing_fields = ['content'];
    source.capture_error = String(error?.message || error || 'Canonical X Article capture failed').slice(0, 1000);
    return refreshNestedEvidence(data);
}
