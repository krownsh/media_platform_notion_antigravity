import express from 'express';
import { searchPostDocuments } from '../services/postSearchService.js';

export const searchRouter = express.Router();

function optionalText(value, maxLength = 200) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized ? normalized.slice(0, maxLength) : null;
}

searchRouter.get('/', async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const results = await searchPostDocuments({
            userId,
            query: optionalText(req.query.q, 1_000),
            limit: req.query.limit,
            platform: optionalText(req.query.platform, 50),
            collectionId: optionalText(req.query.collectionId, 80),
            workflowStage: optionalText(req.query.stage, 50),
            workflowStatus: optionalText(req.query.status, 50)
        });
        return res.json({ results, query: optionalText(req.query.q, 1_000) || '' });
    } catch (error) {
        console.error('[Search] query failed:', error.message);
        return res.status(500).json({ error: 'Failed to search saved posts' });
    }
});
