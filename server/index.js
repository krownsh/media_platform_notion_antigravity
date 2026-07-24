import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { Readable } from 'stream';
import { randomUUID, timingSafeEqual } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import { orchestrator } from './services/orchestrator.js';
import { aiService } from './services/aiService.js';
import { socialMediaService } from './services/socialMediaService.js';
import { supabase } from './supabaseClient.js';
import * as statsService from './services/statsService.js';
import { batchClassify } from './services/batchProcessor.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost"

app.use(cors());
app.use(express.json());

function getBearerToken(req) {
    const auth = req.header('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
}

function apiKeysMatch(providedApiKey, configuredApiKey) {
    if (!providedApiKey || !configuredApiKey) return false;

    const provided = Buffer.from(providedApiKey);
    const configured = Buffer.from(configuredApiKey);
    return provided.length === configured.length && timingSafeEqual(provided, configured);
}

function getApiKeyUserId() {
    // API keys are intended for trusted capture clients such as n8n. Their
    // owner must be configured server-side; request bodies never select it.
    return process.env.MEDIA_API_KEY_USER_ID || null;
}

async function requireApiAuth(req, res, next) {
    const configuredApiKey = process.env.MEDIA_API_KEY;
    const providedApiKey = req.header('x-api-key');

    if (apiKeysMatch(providedApiKey, configuredApiKey)) {
        const userId = getApiKeyUserId();
        if (!userId) {
            return res.status(503).json({ error: 'Capture API key is not mapped to a user' });
        }

        req.auth = { type: 'api_key', userId };
        return next();
    }

    const user = await getSupabaseUserFromRequest(req);
    if (user) {
        req.auth = { type: 'supabase_jwt', userId: user.id };
        return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
}

async function getSupabaseUserFromRequest(req) {
    const token = getBearerToken(req);
    if (!token) return null;

    try {
        const { data, error } = await supabase.auth.getUser(token);
        return !error && data?.user ? data.user : null;
    } catch (error) {
        console.warn('[Auth] Supabase token validation failed:', error.message);
        return null;
    }
}

// Interactive application routes deliberately accept only a user JWT. The
// mapped n8n key is scoped to /api/process and must not become a general API
// credential for publishing, AI usage, or data reads.
async function requireSupabaseJwt(req, res, next) {
    const user = await getSupabaseUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    req.auth = { type: 'supabase_jwt', userId: user.id };
    return next();
}

function getCorrelationId(req) {
    const supplied = req.header('x-correlation-id');
    return supplied && /^[a-zA-Z0-9._-]{1,128}$/.test(supplied) ? supplied : randomUUID();
}

function getAuthenticatedUserId(req) {
    return req.auth?.userId || null;
}

function proxyImageError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function isBlockedProxyAddress(address) {
    const normalized = address.toLowerCase().split('%')[0];
    const family = isIP(normalized);

    if (family === 4) {
        const [first, second] = normalized.split('.').map(Number);
        return first === 0
            || first === 10
            || first === 127
            || (first === 100 && second >= 64 && second <= 127)
            || (first === 169 && second === 254)
            || (first === 172 && second >= 16 && second <= 31)
            || (first === 192 && second === 168)
            || (first === 198 && (second === 18 || second === 19))
            || first >= 224;
    }

    if (family === 6) {
        const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        return normalized === '::'
            || normalized === '::1'
            || normalized.startsWith('fc')
            || normalized.startsWith('fd')
            || normalized.startsWith('fe8')
            || normalized.startsWith('fe9')
            || normalized.startsWith('fea')
            || normalized.startsWith('feb')
            || normalized.startsWith('ff')
            || (mappedIpv4 && isBlockedProxyAddress(mappedIpv4[1]));
    }

    return true;
}

async function getSafeProxyImageUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.length > 2048) {
        throw proxyImageError('Image URL is invalid');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        throw proxyImageError('Image URL is invalid');
    }

    if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
        throw proxyImageError('Only public HTTPS image URLs are allowed');
    }

    let addresses;
    try {
        addresses = await lookup(parsedUrl.hostname, { all: true, verbatim: true });
    } catch {
        throw proxyImageError('Image host could not be resolved');
    }

    if (!addresses.length || addresses.some(({ address }) => isBlockedProxyAddress(address))) {
        throw proxyImageError('Image host is not publicly routable');
    }

    return parsedUrl;
}

function serializeAnalysisSummary(summary) {
    if (!summary) return null;
    return typeof summary === 'object' ? JSON.stringify(summary) : summary;
}

function normalizeCommentTimestamp(value) {
    const timestamp = value ? new Date(value) : new Date();
    return Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
}

function normalizeCapturePlatform(platform) {
    const supportedPlatforms = new Set([
        'instagram', 'facebook', 'twitter', 'threads', 'generic', 'notion', 'youtube', 'github'
    ]);
    return supportedPlatforms.has(platform) ? platform : 'generic';
}

async function finalizeCapture(userId, correlationId, source, data) {
    const analysis = data.analysis || {};
    const originalUrl = data.original_url || data.originalUrl || data.url;
    if (!originalUrl) throw new Error('Capture is missing original_url');

    const { data: finalized, error } = await supabase
        .rpc('finalize_collection_capture', {
            p_user_id: userId,
            p_correlation_id: correlationId,
            p_pipeline_version: 'capture-v2',
            p_capture_quality: source === 'fallback' ? 'degraded' : 'complete',
            p_post: {
                platform: normalizeCapturePlatform(data.platform),
                original_url: originalUrl,
                author_name: data.author || data.author_name || null,
                author_id: data.authorHandle || data.author_id || null,
                author_avatar_url: data.avatar || data.author_avatar_url || null,
                content: data.content || null,
                posted_at: data.posted_at || data.postedAt || null,
                is_archived: data.is_archived ?? false,
                full_json: data.full_json || data.fullJson || null,
                source_domains: data.source_domains || []
            },
            p_analysis: {
        primary_category: analysis.primary_category || 'other',
                summary: serializeAnalysisSummary(analysis.summary),
        tags: analysis.tags || [],
        topics: analysis.topics || [],
                sentiment: analysis.sentiment || null
            },
            p_media: (data.images || []).map((url, index) => ({ url, order: index })),
            p_comments: (data.comments || []).map((comment) => ({
                author_name: comment.user || comment.author || null,
                content: comment.text || comment.content || null,
                commented_at: normalizeCommentTimestamp(comment.postedAt || comment.commented_at),
                raw_data: comment
            }))
        })
        .single();

    if (error) throw new Error(`Capture finalization failed: ${error.message}`);
    if (!finalized?.post_id || !finalized?.outbox_event_id) {
        throw new Error('Capture finalization returned an incomplete result');
    }

    return finalized;
}

// Health Check: explicit endpoint for monitors. Do not use '/' as API success signal.
app.get('/healthz', (req, res) => {
    res.json({
        ok: true,
        service: 'media-collection-api',
        timestamp: new Date().toISOString()
    });
});

// Root placeholder kept for human smoke checks only.
app.get('/', (req, res) => {
    res.send('Social Media Platform Backend is running');
});

// The capture route below may use a mapped n8n key. Every interactive route
// requires a real Supabase user JWT.
app.use('/api/posts', requireSupabaseJwt);
app.use('/api/stats', requireSupabaseJwt);
app.use('/api/analyze-post', requireSupabaseJwt);
app.use('/api/rewrite', requireSupabaseJwt);
app.use('/api/remix', requireSupabaseJwt);
app.use('/api/models', requireSupabaseJwt);
app.use('/api/generate-image', requireSupabaseJwt);
app.use('/api/image-workflow', requireSupabaseJwt);
app.use('/api/publish', requireSupabaseJwt);
app.use('/api/batch-classify', requireSupabaseJwt);

// Process URL Endpoint
app.post('/api/process', requireApiAuth, async (req, res) => {
    const { url } = req.body;
    const userId = getAuthenticatedUserId(req);
    const correlationId = getCorrelationId(req);
    res.set('x-correlation-id', correlationId);

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const result = await orchestrator.processUrl(url);

        // Run AI Analysis based on platform
        if (result.data) {
            const platform = result.data.platform;
            const isSocial = platform === 'threads' || platform === 'twitter';
            const isGeneric = platform === 'generic' || platform === 'unknown' || platform === 'github' || platform === 'notion' || platform === 'youtube';

            // 1) 取得主要分類。分類失敗不可阻止原始來源 finalization。
            result.data.analysis = { primary_category: 'other' };
            try {
                const { categoryProcessor } = await import('./services/categoryProcessor.js');
                result.data.analysis.primary_category = await categoryProcessor.classify(result.data.content || '');
            } catch (categoryError) {
                console.warn('[Server] Category classification failed:', categoryError.message);
                result.data.analysis.error = categoryError.message;
            }

            // 2) 擷取 AI Summary
            if (isSocial && result.data.full_json) {
                console.log(`[Server] Running AI analysis for ${platform} post...`);
                try {
                    const aiResult = await aiService.analyzeThreadsPost(result.data.full_json);
                    if (aiResult) {
                        result.data.analysis.summary = aiResult.summary;
                        result.data.analysis.raw = aiResult.raw;
                        result.data.analysis.tags = aiResult.structured?.tags || [];
                        result.data.analysis.topics = aiResult.structured?.topics || [];
                        console.log('[Server] Social AI analysis completed');
                    } else {
                        throw new Error('AI analysis returned no results');
                    }
                } catch (aiError) {
                    console.warn('[Server] Social AI analysis failed:', aiError.message);
                    result.data.analysis.error = aiError.message;
                }
            } else if (isGeneric && result.data.content) {
                console.log(`[Server] Running Generic AI analysis for ${platform} URL...`);
                try {
                    const aiResult = await aiService.analyzeGenericPost(result.data);
                    if (aiResult) {
                        result.data.analysis.summary = aiResult.summary;
                        result.data.analysis.raw = aiResult.raw;
                        result.data.analysis.tags = aiResult.structured?.tags || [];
                        result.data.analysis.topics = aiResult.structured?.topics || [];
                        console.log('[Server] Generic AI analysis completed');
                    } else {
                        throw new Error('Generic AI analysis returned no results');
                    }
                } catch (aiError) {
                    console.warn('[Server] Generic AI analysis failed:', aiError.message);
                    result.data.analysis.error = aiError.message;
                }
            }

            // 3) A database RPC atomically upserts the source, replaces its
            // child rows, and creates the source.ingested.v1 outbox event.
            try {
                const finalization = await finalizeCapture(userId, correlationId, result.source, result.data);
                result.data.dbId = finalization.post_id;
                result.data.outboxEventId = finalization.outbox_event_id;
                console.log('[Server] Capture finalized with outbox event');
            } catch (error) {
                error.code = 'CAPTURE_FINALIZATION_FAILED';
                throw error;
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error processing URL:', error);

        if (error.code === 'CAPTURE_FINALIZATION_FAILED') {
            return res.status(500).json({
                error: '擷取已完成，但來源 finalization 失敗；請使用 correlation id 重試。',
                correlation_id: correlationId
            });
        }

        // Identify if it's a core platform from the URL if result wasn't reached
        const isCorePlatform = url.includes('threads.net') || url.includes('threads.com') ||
            url.includes('twitter.com') || url.includes('x.com');

        // If it's a core platform, we want to know it failed (Propagate error)
        if (isCorePlatform) {
            return res.status(500).json({ error: `核心平台抓取失敗: ${error.message}` });
        }

        // For generic URLs, use the Fallback: just save the link
        try {
            const fallbackData = {
                source: 'fallback',
                data: {
                    platform: 'generic',
                    original_url: url,
                    title: '連結存檔 (自動容錯)',
                    content: url,
                    analysis: {
                        summary: `⚠️ 此網址目前無法解析詳細內容，已為您自動轉為連結存檔模式。\n原因：${error.message}`
                    }
                }
            };
            const finalization = await finalizeCapture(userId, correlationId, 'fallback', fallbackData.data);
            fallbackData.data.dbId = finalization.post_id;
            fallbackData.data.outboxEventId = finalization.outbox_event_id;
            return res.status(202).json({
                source: 'fallback',
                status: 'degraded',
                data: fallbackData.data,
                correlation_id: correlationId
            });
        } catch {
            res.status(500).json({ error: error.message });
        }
    }
});

// Analyze Post Endpoint
app.post('/api/analyze-post', async (req, res) => {
    const { fullJson } = req.body;

    if (!fullJson) {
        return res.status(400).json({ error: 'fullJson data is required' });
    }

    try {
        const result = await aiService.analyzeThreadsPost(fullJson);
        res.json(result);
    } catch (error) {
        console.error('Error analyzing post:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rewrite Content Endpoint
app.post('/api/rewrite', async (req, res) => {
    const { content, style } = req.body;

    if (!content || !style) {
        return res.status(400).json({ error: 'content and style are required' });
    }

    try {
        const result = await aiService.rewriteContent(content, style);
        res.json({ result });
    } catch (error) {
        console.error('Error rewriting content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remix Content Endpoint (New)
// Remix Content Endpoint (New)
app.post('/api/remix', async (req, res) => {
    const { sourceJson, sourceImages, userParams } = req.body;

    if (!sourceJson) {
        return res.status(400).json({ error: 'sourceJson is required' });
    }

    try {
        const result = await aiService.remixContent(sourceJson, sourceImages, userParams || {});
        res.json({ result });
    } catch (error) {
        console.error('Error remixing content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Model discovery used a removed provider. There is no user-selectable
// provider registry for MiniMax yet, so keep the former route explicit instead
// of failing with an undefined service method.
app.get('/api/models', async (req, res) => {
    res.status(410).json({
        error: 'Model discovery is unavailable while no selectable provider registry is configured.'
    });
});

// Image generation was backed by a retired provider.
app.post('/api/generate-image', async (req, res) => {
    res.status(410).json({
        error: 'Image generation is unavailable because no image provider is configured.'
    });
});

// Image Proxy Endpoint to bypass CORS
app.get('/api/proxy-image', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    try {
        const imageUrl = await getSafeProxyImageUrl(url);
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 10_000);
        const response = await fetch(imageUrl, {
            redirect: 'error',
            signal: abortController.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Referer': 'https://www.threads.net/',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw proxyImageError(`Image host returned ${response.status}`, 502);
        }

        const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
        const allowedImageTypes = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
        if (!allowedImageTypes.has(contentType)) {
            throw proxyImageError('Image host returned an unsupported content type', 415);
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > 10 * 1024 * 1024) {
            throw proxyImageError('Image is too large', 413);
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (response.body) {
            Readable.fromWeb(response.body).pipe(res);
        } else {
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (error) {
        console.error('[Proxy] Error processing image:', error.message);
        res.status(error.statusCode || 502).json({ error: 'Failed to load image' });
    }
});

// Signup Endpoint (Bypass email verification)
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Use admin API to create user with email automatically confirmed
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (error) throw error;

        res.json({ user: data.user });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== Posts API ==========
app.get('/api/posts', async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!isSupabaseConfigured()) {
        return res.status(503).json({ error: 'Database service is not configured' });
    }

    try {
        // Fetch posts
        const { data: posts, error: postsError } = await supabase
            .from('collection_posts')
            .select(`
                *,
                collection_post_media (*),
                collection_post_comments (*),
                collection_post_analysis (*),
                collection_user_annotations (*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (postsError) throw postsError;

        // Fetch collections
        const { data: collections, error: collectionsError } = await supabase
            .from('collection_collections')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (collectionsError) throw collectionsError;

        // Transform data to match frontend expectations
        const formattedPosts = posts.map(post => ({
            id: post.id,
            dbId: post.id,
            platform: post.platform,
            author: post.author_name,
            authorHandle: post.author_id,
            avatar: post.author_avatar_url,
            content: post.content,
            postedAt: post.posted_at,
            originalUrl: post.original_url,
            createdAt: post.created_at,
            fullJson: post.full_json,
            collectionId: post.collection_id,
            images: post.collection_post_media?.filter(m => m.type === 'image').map(m => m.url) || [],
            comments: post.collection_post_comments?.map(c => ({
                user: c.author_name,
                text: c.content,
                postedAt: c.commented_at
            })) || [],
            annotations: post.collection_user_annotations || [],
            analysis: post.collection_post_analysis?.[0] || null
        }));

        res.json({ posts: formattedPosts, collections: collections || [] });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// ========== Annotations (筆記) API ==========

// Database routes require the same service-role configuration used by the
// server client. Do not report success merely because a browser anon key or a
// development fallback URL exists.
const isSupabaseConfigured = () => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    return Boolean(url && serviceKey);
};

// Get annotations for a post
app.get('/api/posts/:postId/annotations', async (req, res) => {
    const { postId } = req.params;
    const userId = getAuthenticatedUserId(req);

    if (!postId) {
        return res.status(400).json({ error: 'Post ID is required' });
    }

    if (!isSupabaseConfigured()) {
        console.warn('[Annotations] Supabase not configured');
        return res.status(503).json({ error: 'Database service is not configured' });
    }

    try {
        const { data, error } = await supabase
            .from('collection_user_annotations')
            .select('*')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .eq('type', 'note')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ annotations: data || [] });
    } catch (error) {
        console.error('Error fetching annotations:', error);
        res.status(500).json({ error: 'Failed to fetch annotations' });
    }
});

// Add annotation to a post
app.post('/api/posts/:postId/annotations', async (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = getAuthenticatedUserId(req);

    if (!postId || !content) {
        return res.status(400).json({ error: 'Post ID and content are required' });
    }

    if (!isSupabaseConfigured()) {
        console.warn('[Annotations] Supabase not configured, cannot save annotation');
        return res.status(503).json({
            error: 'Database service is not configured'
        });
    }

    try {
        const { data: post, error: postError } = await supabase
            .from('collection_posts')
            .select('id')
            .eq('id', postId)
            .eq('user_id', userId)
            .maybeSingle();

        if (postError) throw postError;
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const { data, error } = await supabase
            .from('collection_user_annotations')
            .insert({
                post_id: postId,
                user_id: userId,
                content: content,
                type: 'note'
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ annotation: data });
    } catch (error) {
        console.error('Error creating annotation:', error);
        res.status(500).json({ error: 'Failed to create annotation: ' + error.message });
    }
});

// ========== Retired Image Workflow API ==========
// The former image analysis/generation flow depended on the retired provider. It is kept as
// an authenticated 410 response so stale clients get an actionable answer and
// cannot create workflow records or consume a provider accidentally.
const imageWorkflowRetired = (req, res) => res.status(410).json({
    error: 'Image workflow is retired because no image AI provider is configured.'
});

app.post('/api/image-workflow/step1', imageWorkflowRetired);
app.post('/api/image-workflow/step2', imageWorkflowRetired);
app.post('/api/image-workflow/step3', imageWorkflowRetired);

// Step 4: Publish to Social Media
app.post('/api/publish/instagram', async (req, res) => {
    const { imageUrl, caption } = req.body;
    if (!imageUrl || !caption) return res.status(400).json({ error: 'Image URL and caption are required' });

    try {
        const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
        const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
        const result = await socialMediaService.publishToInstagram(imageUrl, caption, accessToken, accountId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/publish/threads', async (req, res) => {
    const { imageUrl, text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
        const accessToken = process.env.THREADS_ACCESS_TOKEN;
        const userId = process.env.THREADS_USER_ID;
        const result = await socialMediaService.publishToThreads(imageUrl, text, accessToken, userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/publish/twitter', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
        const accessToken = process.env.TWITTER_ACCESS_TOKEN;
        const result = await socialMediaService.publishToTwitter(text, accessToken);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Workflow history is retired together with its provider-backed workflow.
app.get('/api/posts/:postId/image-workflows', async (req, res) => {
    res.status(410).json({
        error: 'Image workflow history is unavailable because the workflow is retired.'
    });
});

// ========== Intelligence Aggregator Stats API ==========

// GET /api/stats/overview - 快速總覽
app.get('/api/stats/overview', async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    try {
        const data = await statsService.getOverview(userId);
        res.json(data);
    } catch (error) {
        console.error('[Stats] overview error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stats/categories - 類別分佈
app.get('/api/stats/categories', async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    try {
        const data = await statsService.getCategoryStats(userId);
        res.json({ categories: data });
    } catch (error) {
        console.error('[Stats] categories error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stats/domains - 熱門 Domain 排行
app.get('/api/stats/domains', async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { limit } = req.query;
    try {
        const data = await statsService.getDomainLeaderboard(userId, parseInt(limit) || 10);
        res.json({ domains: data });
    } catch (error) {
        console.error('[Stats] domains error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stats/authors - Rising Voices 作者統計
app.get('/api/stats/authors', async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { minCount } = req.query;
    try {
        const data = await statsService.getAuthorStats(userId, parseInt(minCount) || 2);
        res.json({ authors: data });
    } catch (error) {
        console.error('[Stats] authors error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stats/trend - 每日跨勢
app.get('/api/stats/trend', async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { days } = req.query;
    try {
        const data = await statsService.getDailyTrend(userId, parseInt(days) || 30);
        res.json({ trend: data });
    } catch (error) {
        console.error('[Stats] trend error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stats/tags - Tag Cloud
app.get('/api/stats/tags', async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    const { limit } = req.query;
    try {
        const data = await statsService.getTagCloud(userId, parseInt(limit) || 20);
        res.json({ tags: data });
    } catch (error) {
        console.error('[Stats] tags error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/batch-classify - 手動觸發批量分類
app.post('/api/batch-classify', async (req, res) => {
    const { ruleOnly = false, limit = 100 } = req.body;
    const userId = getAuthenticatedUserId(req);
    const boundedLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
    try {
        console.log('[BatchClassify] Triggered manually...');
        const result = await batchClassify({ ruleOnly, limit: boundedLimit, userId });
        res.json(result);
    } catch (error) {
        console.error('[BatchClassify] error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unknown API route handler: keep API clients from mistaking Express HTML 404 fallback for app data.
app.use('/api', (req, res) => {
    console.warn('[API] Route not found:', req.method, req.originalUrl);
    res.status(404).json({
        error: 'API route not found',
        method: req.method,
        path: req.originalUrl,
        hint: req.originalUrl === '/api/post'
            ? 'Use POST /api/process to process a URL, or GET /api/posts to list posts.'
            : undefined
    });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server running on ${FRONTEND_URL}:${PORT}`);
    });
}

export { app, requireApiAuth, requireSupabaseJwt };
