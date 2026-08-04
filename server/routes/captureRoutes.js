import { randomUUID } from 'crypto';
import express from 'express';
import { enqueueCaptureRequest, getCaptureRequest, listCaptureRequests } from '../services/captureRequestService.js';
import { decodeUploadFilename, MAX_IMAGE_BYTES, uploadAndEnqueueImageCapture } from '../services/imageCaptureService.js';

function normalizeHeaderToken(value, fallback) {
    return typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(value)
        ? value
        : fallback;
}

export function createCaptureRouter({
    enqueue = enqueueCaptureRequest,
    enqueueImage = uploadAndEnqueueImageCapture,
    lookup = getCaptureRequest,
    list = listCaptureRequests
} = {}) {
    const router = express.Router();

    const respondAccepted = (res, capture) => {
        res.set('x-correlation-id', capture.correlation_id);
        return res.status(202).json({
            capture_id: capture.id,
            input_type: capture.input_type || 'url',
            status: capture.status,
            correlation_id: capture.correlation_id,
            status_url: `/api/captures/${capture.id}`
        });
    };

    router.get('/', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized user scope' });
        try {
            const captures = await list(userId, { limit: req.query.limit });
            return res.json({ captures });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    router.post('/', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized user scope' });

        const correlationId = normalizeHeaderToken(req.header('x-correlation-id'), randomUUID());
        const idempotencyKey = normalizeHeaderToken(req.header('x-idempotency-key'), randomUUID());
        const requestedPriority = Number(req.body?.priority ?? 50);
        const priority = Number.isInteger(requestedPriority) && requestedPriority >= 0 && requestedPriority <= 100
            ? requestedPriority
            : 50;

        try {
            const capture = await enqueue({
                userId,
                url: req.body?.url,
                correlationId,
                idempotencyKey,
                priority,
                requestMeta: {
                    auth_type: req.auth.type,
                    client: req.header('user-agent')?.slice(0, 512) || null
                }
            });

            return respondAccepted(res, capture);
        } catch (error) {
            const validationError = /^url must /.test(error.message);
            return res.status(validationError ? 400 : 500).json({ error: error.message });
        }
    });

    router.post('/images', express.raw({ type: 'image/*', limit: MAX_IMAGE_BYTES }), async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized user scope' });

        const correlationId = normalizeHeaderToken(req.header('x-correlation-id'), randomUUID());
        const idempotencyKey = normalizeHeaderToken(req.header('x-idempotency-key'), randomUUID());
        const requestedPriority = Number(req.header('x-capture-priority') ?? 50);
        const priority = Number.isInteger(requestedPriority) && requestedPriority >= 0 && requestedPriority <= 100
            ? requestedPriority
            : 50;

        try {
            const capture = await enqueueImage({
                userId,
                buffer: req.body,
                contentType: req.header('content-type'),
                originalFilename: decodeUploadFilename(req.header('x-file-name')),
                correlationId,
                idempotencyKey,
                priority,
                requestMeta: {
                    auth_type: req.auth.type,
                    client: req.header('user-agent')?.slice(0, 512) || null
                }
            });
            return respondAccepted(res, capture);
        } catch (error) {
            return res.status(error.statusCode || 500).json({
                error: error.message,
                code: error.code || 'IMAGE_CAPTURE_FAILED'
            });
        }
    });

    router.get('/:id', async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized user scope' });
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
            return res.status(400).json({ error: 'capture id must be a UUID' });
        }

        try {
            const capture = await lookup(req.params.id, userId);
            if (!capture) return res.status(404).json({ error: 'Capture not found' });
            return res.json({ capture });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

    router.use((error, _req, res, next) => {
        if (error?.type === 'entity.too.large') {
            return res.status(413).json({ error: 'image must be 15 MB or smaller', code: 'IMAGE_TOO_LARGE' });
        }
        return next(error);
    });

    return router;
}

export const captureRouter = createCaptureRouter();
