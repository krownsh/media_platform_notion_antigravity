import express from 'express';
import { loadOwnerSearchInputs } from '../services/ownerSearchService.js';
import { createOwnerLibraryFolder, setOwnerLibraryFolder } from '../services/ownerLibraryOrganizationService.js';

function first(value) {
    return Array.isArray(value) ? value[0] || null : value || null;
}

function statusFor(error) {
    if (['OWNER_LIBRARY_POST_NOT_FOUND', 'OWNER_LIBRARY_FOLDER_NOT_FOUND'].includes(error?.code)) return 404;
    if (/must be|is required|not found|not selectable/i.test(error?.message || '')) return 400;
    if (/VERSION_CONFLICT|NOT_OPEN|NOT_REVIEWABLE/.test(error?.message || '')) return 409;
    return 500;
}

export function createOwnerLibraryRouter({
    loadPost = loadOwnerSearchInputs,
    createFolder = createOwnerLibraryFolder,
    setFolder = setOwnerLibraryFolder
} = {}) {
    const router = express.Router();
    router.get('/posts/:postId', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const item = await loadPost({ userId, postId: req.params.postId });
            return res.json({
                post: item.post,
                source_revision: item.sourceRevision,
                learning_note: item.learningNote,
                topic_links: item.topicLinks.map(link => ({ ...link, topic: first(link.owner_topics) })),
                topic_revisions: item.topicRevisions.map(revision => ({ ...revision, topic: first(revision.owner_topics) })),
                project_references: item.projectReferences.map(reference => ({
                    ...reference, topic: first(reference.owner_topics), project: first(reference.owner_project_catalog)
                })),
                candidates: item.proposals.filter(proposal => ['pending', 'proposed'].includes(proposal.status))
            });
        } catch (error) {
            const status = /not found/.test(error.message) ? 404 : 500;
            return res.status(status).json({ error: status === 404 ? 'Source not found' : 'Failed to load source detail' });
        }
    });
    router.post('/folders', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            return res.status(201).json({ collection: await createFolder({ userId, name: req.body?.name }) });
        } catch (error) {
            return res.status(statusFor(error)).json({ error: error.message });
        }
    });
    router.patch('/posts/:postId/folder', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            return res.json(await setFolder({ userId, postId: req.params.postId, collectionId: req.body?.collection_id ?? null }));
        } catch (error) {
            return res.status(statusFor(error)).json({ error: error.message });
        }
    });
    return router;
}

export const ownerLibraryRouter = createOwnerLibraryRouter();
