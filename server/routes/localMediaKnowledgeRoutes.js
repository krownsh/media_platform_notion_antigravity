import express from 'express';
import { loadOwnerSearchInputs } from '../services/ownerSearchService.js';
import { loadPostCaseFileManifest } from '../services/localMediaKnowledgeService.js';
import { describeLocalPostRecord } from '../services/localMediaKnowledgeStatusService.js';

export function createLocalMediaKnowledgeRouter({
    loadPost = loadOwnerSearchInputs,
    loadManifest = loadPostCaseFileManifest
} = {}) {
    const router = express.Router();
    router.get('/posts/:postId', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const input = { userId, postId: req.params.postId };
            const [post, manifest] = await Promise.all([loadPost(input), loadManifest(input)]);
            return res.json({ local_record: describeLocalPostRecord({ sourceRevision: post.sourceRevision, manifest }) });
        } catch (error) {
            const status = /not found/.test(error.message) ? 404 : 500;
            return res.status(status).json({ error: status === 404 ? 'Source not found' : 'Failed to load local record status' });
        }
    });
    return router;
}

export const localMediaKnowledgeRouter = createLocalMediaKnowledgeRouter();
