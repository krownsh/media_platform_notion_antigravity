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
import { aiService } from './services/aiService.js';
import { socialMediaService } from './services/socialMediaService.js';
import { supabase, isSupabaseConfigured as hasSupabaseServiceConfig } from './supabaseClient.js';
import * as statsService from './services/statsService.js';
import { batchClassify } from './services/batchProcessor.js';
import { suggestTopicMatches } from './services/topicAgent.js';
import { agentJobRouter } from './routes/agentJobRoutes.js';
import { pocWorkbenchRouter } from './routes/pocWorkbenchRoutes.js';
import { captureRouter } from './routes/captureRoutes.js';
import { resolveStoredMediaUrls } from './services/mediaUrlService.js';
import { processUrlThroughCaptureQueue } from './services/legacyProcessService.js';
import { searchRouter } from './routes/searchRoutes.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost";

app.use(cors());
app.use(express.json());

function getBearerToken(req) {
    const authorization = req.header('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
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

// Capture endpoints may use a mapped n8n key. Every interactive route requires
// a real Supabase user JWT.
app.use('/api/captures', requireApiAuth, captureRouter);
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
app.use('/api/topics', requireSupabaseJwt);
app.use('/api/search', requireSupabaseJwt, searchRouter);

function normalizeTopicTextList(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 30)
        : [];
}

// Topic workspaces are user-created working contexts. Agent proposals and
// source-match acceptance are intentionally separate future actions.
app.get('/api/topics', async (req, res) => {
    if (!hasSupabaseServiceConfig) {
        return res.status(503).json({ error: 'Database service is not configured' });
    }

    try {
        const { data, error } = await supabase
            .from('collection_topics')
            .select('*')
            .eq('user_id', getAuthenticatedUserId(req))
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return res.json({ topics: data || [] });
    } catch (error) {
        console.error('[Topics] list failed:', error.message);
        return res.status(500).json({ error: 'Failed to list topics' });
    }
});

app.post('/api/topics', async (req, res) => {
    if (!hasSupabaseServiceConfig) {
        return res.status(503).json({ error: 'Database service is not configured' });
    }

    const { title, slug, description = null, purpose = null, desired_outcomes, keywords } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 160) {
        return res.status(400).json({ error: 'title must be a non-empty string up to 160 characters' });
    }
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,79}$/i.test(slug)) {
        return res.status(400).json({ error: 'slug must be 2-80 letters, numbers, underscores, or hyphens' });
    }

    try {
        const { data, error } = await supabase
            .from('collection_topics')
            .insert({
                user_id: getAuthenticatedUserId(req),
                title: title.trim(),
                slug: slug.toLowerCase(),
                description: typeof description === 'string' ? description.trim() || null : null,
                purpose: typeof purpose === 'string' ? purpose.trim() || null : null,
                desired_outcomes: normalizeTopicTextList(desired_outcomes),
                keywords: normalizeTopicTextList(keywords),
                origin: 'user',
                status: 'active'
            })
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json({ topic: data });
    } catch (error) {
        console.error('[Topics] create failed:', error.message);
        return res.status(500).json({ error: 'Failed to create topic' });
    }
});

app.post('/api/topics/matches/dry-run', async (req, res) => {
    if (!hasSupabaseServiceConfig) {
        return res.status(503).json({ error: 'Database service is not configured' });
    }

    const { sourceId } = req.body || {};
    if (typeof sourceId !== 'string' || !sourceId) {
        return res.status(400).json({ error: 'sourceId is required' });
    }

    const userId = getAuthenticatedUserId(req);
    try {
        const [{ data: source, error: sourceError }, { data: topics, error: topicError }] = await Promise.all([
            supabase
                .from('collection_posts')
                .select('id, content, original_url, source_domains')
                .eq('id', sourceId)
                .eq('user_id', userId)
                .single(),
            supabase
                .from('collection_topics')
                .select('id, title, description, keywords, status')
                .eq('user_id', userId)
                .eq('status', 'active')
        ]);

        if (sourceError) throw sourceError;
        if (topicError) throw topicError;
        return res.json({ source_id: source.id, matches: suggestTopicMatches(source, topics || []) });
    } catch (error) {
        console.error('[Topics] dry-run failed:', error.message);
        return res.status(500).json({ error: 'Failed to match source to topics' });
    }
});

// Process URL Endpoint
app.post('/api/process', requireApiAuth, async (req, res) => {
    const { url } = req.body;
    const userId = getAuthenticatedUserId(req);
    const correlationId = getCorrelationId(req);
    res.set('x-correlation-id', correlationId);

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    if (!hasSupabaseServiceConfig) {
        return res.status(503).json({ error: 'Database service is not configured' });
    }

    try {
        const suppliedIdempotencyKey = req.header('x-idempotency-key');
        const idempotencyKey = suppliedIdempotencyKey
            && /^[a-zA-Z0-9._:-]{1,128}$/.test(suppliedIdempotencyKey)
            ? suppliedIdempotencyKey
            : correlationId;
        const result = await processUrlThroughCaptureQueue({
            userId,
            url,
            correlationId,
            idempotencyKey,
            timeoutMs: process.env.LEGACY_PROCESS_WAIT_MS,
            requestMeta: {
                auth_type: req.auth.type,
                client: req.header('user-agent')?.slice(0, 512) || null,
                compatibility_route: '/api/process'
            }
        });

        return res.status(result.status === 'degraded' ? 202 : 200).json(result);
    } catch (error) {
        console.error('Error processing URL:', error);

        return res.status(error.code === 'CAPTURE_WAIT_TIMEOUT' ? 504 : 500).json({
            error: error.message,
            code: error.code || 'CAPTURE_FAILED',
            correlation_id: correlationId
        });
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
    if (!hasSupabaseServiceConfig) {
        return res.status(503).json({ error: 'Database service is not configured' });
    }

    try {
        const postSelection = `
            *,
            collection_post_media (*),
            collection_post_comments (*),
            collection_post_analysis (*),
            collection_post_workflows (*),
            collection_user_annotations (*),
            content_assets (
                id, source_id, title, format, status, metadata, created_at, updated_at,
                content_revisions (id, revision_number, body, author_type, created_at, updated_at),
                content_evidence_links (id, evidence_type, target_id, citation_text)
            )
        `;
        // Fetch posts. The workflow relation is deployed in Stage G; the
        // fallback keeps existing environments readable until that deployment
        // has been applied.
        let { data: posts, error: postsError } = await supabase
            .from('collection_posts')
            .select(postSelection)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (postsError && /(collection_post_workflows|content_assets)/i.test(postsError.message || '')) {
            ({ data: posts, error: postsError } = await supabase
                .from('collection_posts')
                .select(`
                    *,
                    collection_post_media (*),
                    collection_post_comments (*),
                    collection_post_analysis (*),
                    collection_user_annotations (*)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false }));
        }

        if (postsError) throw postsError;

        const postsWithResolvedMedia = await resolveStoredMediaUrls(posts || [], supabase);

        // Fetch collections
        const { data: collections, error: collectionsError } = await supabase
            .from('collection_collections')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (collectionsError) throw collectionsError;

        // Transform data to match frontend expectations
        const formattedPosts = postsWithResolvedMedia.map(post => ({
            id: post.id,
            dbId: post.id,
            platform: post.platform,
            author: post.author_name,
            authorHandle: post.author_id,
            avatar: null,
            content: post.content,
            postedAt: post.posted_at,
            originalUrl: post.platform === 'image' ? null : post.original_url,
            createdAt: post.created_at,
            fullJson: post.full_json,
            collectionId: post.collection_id,
            images: post.collection_post_media?.filter(m => m.type === 'image' && m.url).map(m => m.url) || [],
            comments: post.collection_post_comments?.map(c => ({
                user: c.author_name,
                text: c.content,
                postedAt: c.commented_at
            })) || [],
            annotations: post.collection_user_annotations || [],
            analysis: post.collection_post_analysis?.[0] || null,
            workflow: post.collection_post_workflows?.[0] || null,
            reviewRequest: post.collection_post_workflows?.[0]?.context?.review_request || null,
            vault: post.collection_post_workflows?.[0]?.context?.vault || null,
            drafts: (post.content_assets || []).map(asset => ({
                ...asset,
                latestRevision: [...(asset.content_revisions || [])]
                    .sort((a, b) => Number(b.revision_number || 0) - Number(a.revision_number || 0))[0] || null
            }))
        }));

        res.json({ posts: formattedPosts, collections: collections || [] });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// ========== Annotations (筆記) API ==========

// Get annotations for a post
app.get('/api/posts/:postId/annotations', async (req, res) => {
    const { postId } = req.params;
    const userId = getAuthenticatedUserId(req);

    if (!postId) {
        return res.status(400).json({ error: 'Post ID is required' });
    }

    if (!hasSupabaseServiceConfig) {
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

    if (!hasSupabaseServiceConfig) {
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

// Agent Job Control Plane API
app.use('/api/agent/jobs', requireSupabaseJwt, agentJobRouter);
app.use('/api/poc-workbench', requireSupabaseJwt, pocWorkbenchRouter);

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
