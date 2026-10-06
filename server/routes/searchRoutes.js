import express from 'express';
import { searchOwnerPostDocuments } from '../services/ownerSearchService.js';

function optionalText(value, maxLength = 200) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized ? normalized.slice(0, maxLength) : null;
}

function optionalBoolean(value) {
    return value === 'true' || value === '1';
}

export function createSearchRouter({ search = searchOwnerPostDocuments } = {}) {
    const searchRouter = express.Router();
    searchRouter.get('/', async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const results = await search({
            userId,
            query: optionalText(req.query.q, 1_000),
            limit: req.query.limit,
            includeCandidates: optionalBoolean(req.query.includeCandidates)
        });
        return res.json({ results, query: optionalText(req.query.q, 1_000) || '', include_candidates: optionalBoolean(req.query.includeCandidates) });
    } catch (error) {
        console.error('[Search] query failed:', error.message);
        return res.status(500).json({ error: 'Failed to search saved posts' });
    }
    });
    return searchRouter;
}

export const searchRouter = createSearchRouter();
