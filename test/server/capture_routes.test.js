import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createCaptureRouter } from '../../server/routes/captureRoutes.js';

async function withServer(dependencies, run) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.auth = { type: 'api_key', userId: '22222222-2222-4222-8222-222222222222' };
        next();
    });
    app.use('/api/captures', createCaptureRouter(dependencies));

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    try {
        const { port } = server.address();
        await run(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
}

test('POST /api/captures returns 202 with durable request identity', async () => {
    let input;
    await withServer({
        enqueue: async (value) => {
            input = value;
            return {
                id: '11111111-1111-4111-8111-111111111111',
                status: 'accepted',
                correlation_id: value.correlationId
            };
        }
    }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/captures`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-correlation-id': 'route-test-correlation',
                'x-idempotency-key': 'route-test-idempotency'
            },
            body: JSON.stringify({ url: 'https://example.com/post', priority: 90 })
        });
        const body = await response.json();

        assert.equal(response.status, 202);
        assert.equal(body.capture_id, '11111111-1111-4111-8111-111111111111');
        assert.equal(body.status, 'accepted');
        assert.equal(response.headers.get('x-correlation-id'), 'route-test-correlation');
        assert.equal(input.userId, '22222222-2222-4222-8222-222222222222');
        assert.equal(input.idempotencyKey, 'route-test-idempotency');
        assert.equal(input.priority, 90);
    });
});

test('GET /api/captures/:id passes the authenticated tenant to lookup', async () => {
    let lookupScope;
    await withServer({
        lookup: async (requestId, userId) => {
            lookupScope = { requestId, userId };
            return { id: requestId, status: 'finalized' };
        }
    }, async (baseUrl) => {
        const requestId = '11111111-1111-4111-8111-111111111111';
        const response = await fetch(`${baseUrl}/api/captures/${requestId}`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.capture.status, 'finalized');
        assert.deepEqual(lookupScope, {
            requestId,
            userId: '22222222-2222-4222-8222-222222222222'
        });
    });
});

test('POST /api/captures/images accepts raw image bytes and returns 202', async () => {
    let imageInput;
    await withServer({
        enqueueImage: async (value) => {
            imageInput = value;
            return {
                id: '33333333-3333-4333-8333-333333333333',
                input_type: 'image',
                status: 'accepted',
                correlation_id: value.correlationId
            };
        }
    }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/captures/images`, {
            method: 'POST',
            headers: {
                'content-type': 'image/png',
                'x-file-name': encodeURIComponent('研究圖.png'),
                'x-idempotency-key': 'image-route-idempotency'
            },
            body: Buffer.from([0x89, 0x50, 0x4e, 0x47])
        });
        const body = await response.json();

        assert.equal(response.status, 202);
        assert.equal(body.input_type, 'image');
        assert.equal(body.capture_id, '33333333-3333-4333-8333-333333333333');
        assert.equal(imageInput.originalFilename, '研究圖.png');
        assert.equal(imageInput.contentType, 'image/png');
        assert.ok(Buffer.isBuffer(imageInput.buffer));
    });
});
