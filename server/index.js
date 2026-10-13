import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { Readable } from 'stream';
import { timingSafeEqual } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import { supabase, isSupabaseConfigured as hasSupabaseServiceConfig } from './supabaseClient.js';
import * as statsService from './services/statsService.js';
import { captureRouter } from './routes/captureRoutes.js';
import { resolveStoredMediaUrls } from './services/mediaUrlService.js';
import { searchRouter } from './routes/searchRoutes.js';
import { reviewRouter } from './routes/reviewRoutes.js';
import { ownerKnowledgeRouter } from './routes/ownerKnowledgeRoutes.js';
import { ownerLibraryRouter } from './routes/ownerLibraryRoutes.js';
import { localMediaKnowledgeRouter } from './routes/localMediaKnowledgeRoutes.js';


const app = express();
const PORT = process.env.PORT || 3001;
// Keep the collection API on its stable port while allowing the deployment
// runtime to select a dedicated loopback address when another local tool owns
// 127.0.0.1. Undefined preserves Node's normal host binding for every other
// environment.
const BIND_HOST = process.env.MEDIA_API_BIND_HOST || undefined;
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
// mapped capture key is scoped to /api/captures and must not become a general
// credential for browsing, knowledge decisions, or data reads.
async function requireSupabaseJwt(req, res, next) {
    const user = await getSupabaseUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    req.auth = { type: 'supabase_jwt', userId: user.id };
    return next();
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
app.use('/api/search', requireSupabaseJwt, searchRouter);
app.use('/api/review', requireSupabaseJwt, reviewRouter);
app.use('/api/owner-knowledge', requireSupabaseJwt, ownerKnowledgeRouter);
app.use('/api/owner-library', requireSupabaseJwt, ownerLibraryRouter);
app.use('/api/local-records', requireSupabaseJwt, localMediaKnowledgeRouter);


app.get('/api/activity', requireSupabaseJwt, async (req, res) => {
    if (!hasSupabaseServiceConfig) return res.status(503).json({ error: 'Database service is not configured' });
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 20;
    try {
        const { data, error } = await supabase
            .from('collection_activity_events')
            .select('id, post_id, event_type, event_result, summary, error_code, error_message, metadata, created_at')
            .eq('user_id', getAuthenticatedUserId(req))
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return res.json({ events: data || [] });
    } catch (error) {
        console.error('[Activity] list failed:', error.message);
        return res.status(500).json({ error: 'Failed to list activity events' });
    }
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
        const { data: posts, error: postsError } = await supabase
            .from('collection_posts')
            .select(`
                *,
                collection_post_media (*),
                collection_post_comments (*),
                collection_user_annotations (*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (postsError) throw postsError;

        const postsWithResolvedMedia = await resolveStoredMediaUrls(posts || [], supabase);

        // Fetch collections
        const { data: collections, error: collectionsError } = await supabase
            .from('collection_collections')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (collectionsError) throw collectionsError;

        // Preserve the established card payload without reading any retired
        // analysis/workflow/content tables. The null compatibility fields can
        // be removed after the last old frontend deployment has aged out.
        const formattedPosts = postsWithResolvedMedia.map(post => {
            return {
            id: post.id,
            dbId: post.id,
            platform: post.platform,
            title: post.title || null,
            sourceTitle: post.title || null,
            author: post.author_name,
            authorHandle: post.author_id,
            avatar: null,
            content: post.content,
            postedAt: post.posted_at,
            originalUrl: post.platform === 'image' ? null : post.original_url,
            createdAt: post.created_at,
            fullJson: post.full_json,
            collectionId: post.collection_id,
            sourceDomains: Array.isArray(post.source_domains) ? post.source_domains : [],
            images: post.collection_post_media?.filter(m => m.type === 'image' && m.url).map(m => m.url) || [],
            comments: post.collection_post_comments?.map(c => ({
                user: c.author_name,
                text: c.content,
                postedAt: c.commented_at
            })) || [],
            annotations: post.collection_user_annotations || [],
            analysis: null,
            workflow: null,
            parallelTracks: [],
            reviewRequest: null,
            vault: null,
            drafts: []
            };
        });

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

// Unknown API route handler: keep API clients from mistaking Express HTML 404 fallback for app data.
app.use('/api', (req, res) => {
    console.warn('[API] Route not found:', req.method, req.originalUrl);
    res.status(404).json({
        error: 'API route not found',
        method: req.method,
        path: req.originalUrl,
        hint: req.originalUrl === '/api/post'
            ? 'Use POST /api/captures to submit a source, or GET /api/posts to list posts.'
            : undefined
    });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, BIND_HOST, () => {
        const displayHost = BIND_HOST || FRONTEND_URL;
        console.log(`Server running on ${displayHost}:${PORT}`);
    });
}

export { app, requireApiAuth, requireSupabaseJwt };
