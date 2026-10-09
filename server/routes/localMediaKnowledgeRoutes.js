import express from 'express';
import { loadOwnerSearchInputs } from '../services/ownerSearchService.js';
import { loadPostCaseFileManifest } from '../services/localMediaKnowledgeService.js';
import { describeLocalPostRecord } from '../services/localMediaKnowledgeStatusService.js';
import { createOrRetryLocalPostCaseFile } from '../services/localMediaKnowledgeWorkflowService.js';

export function createLocalMediaKnowledgeRouter({
    loadPost = loadOwnerSearchInputs,
    loadManifest = loadPostCaseFileManifest,
    createOrRetry = createOrRetryLocalPostCaseFile
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
    router.post('/posts/:postId/sync', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const result = await createOrRetry({ userId, postId: req.params.postId });
            return res.json({ result, local_record: describeLocalPostRecord({ sourceRevision: { id: result.manifest.source_revision_id || 'recorded' }, manifest: result.manifest }) });
        } catch (error) {
            const status = error.message === 'LOCAL_NOTE_SOURCE_REVISION_REQUIRED' ? 409 : 500;
            return res.status(status).json({ error: status === 409 ? 'Source revision is required before creating a local record' : 'Failed to create local record' });
        }
    });
    return router;
}

export const localMediaKnowledgeRouter = createLocalMediaKnowledgeRouter();
