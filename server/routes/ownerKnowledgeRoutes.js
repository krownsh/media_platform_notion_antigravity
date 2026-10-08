import express from 'express';
import {
    createOwnerTopic,
    createPocProposal,
    createProjectCatalogEntry,
    decidePocProposal,
    importLegacyProjectToCatalog,
    listLegacyProjects,
    listOwnerTopics,
    listProjectCatalog,
    listTopicProjectReferences
} from '../services/ownerKnowledgeService.js';

function statusFor(error) {
    if (error?.code === '23505') return 409;
    if (/must be|PROJECT_REFERENCE_NOT_FOUND|LEGACY_PROJECT_NOT_FOUND/.test(error?.message || '')) return 400;
    if (error?.code === 'POC_PROPOSAL_CONFLICT') return 409;
    return 500;
}

export function createOwnerKnowledgeRouter(dependencies = {}) {
    const router = express.Router();
    const services = {
        createOwnerTopic,
        createPocProposal,
        createProjectCatalogEntry,
        decidePocProposal,
        importLegacyProjectToCatalog,
        listLegacyProjects,
        listOwnerTopics,
        listProjectCatalog,
        listTopicProjectReferences,
        ...dependencies
    };
    const userId = req => req.auth?.userId;

    router.get('/topics', async (req, res) => {
        try { return res.json({ topics: await services.listOwnerTopics({ userId: userId(req) }) }); }
        catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    router.get('/topics/:topicId', async (req, res) => {
        try {
            const topics = await services.listOwnerTopics({ userId: userId(req), topicId: req.params.topicId });
            if (!topics[0]) return res.status(404).json({ error: 'Topic not found' });
            return res.json({ topic: topics[0] });
        } catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    router.post('/topics', async (req, res) => {
        try { return res.status(201).json({ topic: await services.createOwnerTopic({ userId: userId(req), label: req.body?.label }) }); }
        catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    router.get('/projects', async (req, res) => {
        try { return res.json({ projects: await services.listProjectCatalog({ userId: userId(req) }) }); }
        catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    router.get('/legacy-projects', async (req, res) => {
        try { return res.json({ projects: await services.listLegacyProjects({ userId: userId(req) }) }); }
        catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    router.post('/legacy-projects/:projectId/import', async (req, res) => {
        try {
            return res.status(201).json({ project: await services.importLegacyProjectToCatalog({
                userId: userId(req), legacyProjectId: req.params.projectId
            }) });
        } catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    router.post('/projects', async (req, res) => {
        try { return res.status(201).json({ project: await services.createProjectCatalogEntry({ userId: userId(req), input: req.body }) }); }
        catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    router.get('/project-references', async (req, res) => {
        try { return res.json({ references: await services.listTopicProjectReferences({ userId: userId(req) }) }); }
        catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    router.post('/project-references/:referenceId/poc-proposals', async (req, res) => {
        try {
            return res.status(201).json({ proposal: await services.createPocProposal({
                userId: userId(req), projectReferenceId: req.params.referenceId,
                objective: req.body?.objective, isolationSpec: req.body?.isolation_spec || {}
            }) });
        } catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    router.post('/poc-proposals/:proposalId/:action', async (req, res) => {
        try {
            return res.json({ proposal: await services.decidePocProposal({
                userId: userId(req), proposalId: req.params.proposalId, action: req.params.action,
                expectedVersion: req.body?.expected_version
            }) });
        } catch (error) { return res.status(statusFor(error)).json({ error: error.message }); }
    });
    return router;
}

export const ownerKnowledgeRouter = createOwnerKnowledgeRouter();
