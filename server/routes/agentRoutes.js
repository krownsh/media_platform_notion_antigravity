import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { supabase } from '../supabaseClient.js';

function apiKeysMatch(providedApiKey, configuredApiKey) {
    if (typeof providedApiKey !== 'string' || typeof configuredApiKey !== 'string') return false;
    const provided = Buffer.from(providedApiKey);
    const configured = Buffer.from(configuredApiKey);
    return provided.length === configured.length && timingSafeEqual(provided, configured);
}

export function requireAgentDraftApiKey(req, res, next) {
    const configuredKey = process.env.AGENT_DRAFT_API_KEY;
    if (!configuredKey) {
        return res.status(503).json({ error: 'Agent draft API is not configured' });
    }

    const authHeader = req.header('authorization');
    const bearerKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const providedKey = req.header('x-api-key') || bearerKey;

    if (!providedKey || !apiKeysMatch(providedKey, configuredKey)) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    }

    next();
}

function formatDraftPayload(asset) {
    const revisions = Array.isArray(asset.content_revisions) ? [...asset.content_revisions] : [];
    // Sort revisions by revision_number descending to extract the latest
    revisions.sort((a, b) => (b.revision_number || 0) - (a.revision_number || 0));
    const latestRevision = revisions[0] || null;

    return {
        id: asset.id,
        title: asset.title,
        format: asset.format,
        status: asset.status,
        content: latestRevision ? latestRevision.body : '',
        latest_revision_number: latestRevision ? latestRevision.revision_number : null,
        change_summary: latestRevision ? latestRevision.change_summary : null,
        metadata: asset.metadata || {},
        created_at: asset.created_at,
        updated_at: asset.updated_at,
        revisions: revisions.map((rev) => ({
            id: rev.id,
            revision_number: rev.revision_number,
            body: rev.body,
            change_summary: rev.change_summary,
            author_type: rev.author_type,
            created_at: rev.created_at,
            updated_at: rev.updated_at
        }))
    };
}

export function createAgentRouter({ db = supabase } = {}) {
    const router = express.Router();

    // All endpoints under this router require the dedicated Agent API Key
    router.use(requireAgentDraftApiKey);

    // GET /api/agent/drafts
    router.get('/drafts', async (req, res) => {
        try {
            const { status = 'draft', format, limit } = req.query;
            const parsedLimit = Number.parseInt(limit, 10);
            const queryLimit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;

            let query = db
                .from('content_assets')
                .select(`
                    id,
                    title,
                    format,
                    status,
                    metadata,
                    created_at,
                    updated_at,
                    content_revisions (
                        id,
                        revision_number,
                        body,
                        change_summary,
                        author_type,
                        created_at,
                        updated_at
                    )
                `)
                .order('updated_at', { ascending: false })
                .limit(queryLimit);

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }

            if (format) {
                query = query.eq('format', format);
            }

            const { data, error } = await query;
            if (error) throw error;

            const drafts = (data || []).map(formatDraftPayload);
            return res.json({
                success: true,
                count: drafts.length,
                drafts
            });
        } catch (error) {
            console.error('[AgentAPI] Failed to query drafts:', error);
            return res.status(500).json({ error: 'Failed to retrieve drafts' });
        }
    });

    // GET /api/agent/drafts/:id
    router.get('/drafts/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { data, error } = await db
                .from('content_assets')
                .select(`
                    id,
                    title,
                    format,
                    status,
                    metadata,
                    created_at,
                    updated_at,
                    content_revisions (
                        id,
                        revision_number,
                        body,
                        change_summary,
                        author_type,
                        created_at,
                        updated_at
                    )
                `)
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                return res.status(404).json({ error: 'Draft not found' });
            }

            return res.json({
                success: true,
                draft: formatDraftPayload(data)
            });
        } catch (error) {
            console.error('[AgentAPI] Failed to get draft by id:', error);
            return res.status(500).json({ error: 'Failed to retrieve draft' });
        }
    });

    return router;
}

export default createAgentRouter();
