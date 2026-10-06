import express from 'express';
import {
    listReviewPackets,
    loadReviewPacket,
    deferReviewPacket,
    resumeReviewPacket,
    decideReviewProposal
} from '../services/reviewPacketService.js';
import { prepareInitialReviewProposals } from '../services/reviewProposalService.js';
import { promoteReviewProposal } from '../services/reviewPromotionService.js';

function positiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isReviewConflict(error) {
    return error?.code === 'P0001' || /REVIEW_VERSION_CONFLICT|REVIEW_PACKET_NOT_OPEN|REVIEW_PROPOSAL_NOT_REVIEWABLE/.test(error?.message || '');
}

export function createReviewRouter({
    listPackets = listReviewPackets,
    loadPacket = loadReviewPacket,
    deferPacket = deferReviewPacket,
    resumePacket = resumeReviewPacket,
    decideProposal = decideReviewProposal,
    prepareProposals = prepareInitialReviewProposals,
    promoteProposal = promoteReviewProposal
} = {}) {
    const router = express.Router();

    router.get('/packets', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            return res.json({ packets: await listPackets({ userId, limit: req.query.limit }) });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    router.get('/packets/:packetId', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const packet = await loadPacket({ userId, packetId: req.params.packetId });
            if (!packet) return res.status(404).json({ error: 'Review packet not found' });
            return res.json({ packet });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    router.post('/source-revisions/:sourceRevisionId/prepare', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        try {
            return res.status(202).json({ review: await prepareProposals({
                userId,
                sourceRevisionId: req.params.sourceRevisionId,
                allowPartial: req.body?.allow_partial === true
            }) });
        } catch (error) {
            return res.status(isReviewConflict(error) ? 409 : 400).json({ error: error.message });
        }
    });

    router.post('/packets/:packetId/defer', async (req, res) => {
        const userId = req.auth?.userId;
        const expectedVersion = positiveInteger(req.body?.expected_version);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!expectedVersion) return res.status(400).json({ error: 'expected_version must be a positive integer' });
        try {
            const packet = await deferPacket({
                userId,
                packetId: req.params.packetId,
                expectedVersion,
                reason: req.body?.reason ?? null,
                deferredUntil: req.body?.deferred_until ?? null
            });
            return res.json({ packet });
        } catch (error) {
            return res.status(isReviewConflict(error) ? 409 : 400).json({ error: error.message });
        }
    });

    router.post('/packets/:packetId/resume', async (req, res) => {
        const userId = req.auth?.userId;
        const expectedVersion = positiveInteger(req.body?.expected_version);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!expectedVersion) return res.status(400).json({ error: 'expected_version must be a positive integer' });
        try {
            const packet = await resumePacket({ userId, packetId: req.params.packetId, expectedVersion });
            return res.json({ packet });
        } catch (error) {
            return res.status(isReviewConflict(error) ? 409 : 400).json({ error: error.message });
        }
    });

    async function decide(req, res, action) {
        const userId = req.auth?.userId;
        const expectedVersion = positiveInteger(req.body?.expected_version);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!expectedVersion) return res.status(400).json({ error: 'expected_version must be a positive integer' });
        if (action === 'edit_and_accept' && (!req.body?.edited_payload || typeof req.body.edited_payload !== 'object' || Array.isArray(req.body.edited_payload))) {
            return res.status(400).json({ error: 'edited_payload must be an object' });
        }
        try {
            const input = {
                userId,
                packetId: req.params.packetId,
                proposalId: req.params.proposalId,
                action,
                expectedVersion,
                editedPayload: req.body?.edited_payload ?? null
            };
            const packet = action === 'reject'
                ? await decideProposal(input)
                : await promoteProposal(input);
            return res.json({ packet });
        } catch (error) {
            return res.status(isReviewConflict(error) ? 409 : 400).json({ error: error.message });
        }
    }

    router.post('/packets/:packetId/proposals/:proposalId/accept', (req, res) => decide(req, res, 'accept'));
    router.post('/packets/:packetId/proposals/:proposalId/reject', (req, res) => decide(req, res, 'reject'));
    router.post('/packets/:packetId/proposals/:proposalId/edit-and-accept', (req, res) => decide(req, res, 'edit_and_accept'));

    return router;
}

export const reviewRouter = createReviewRouter();
