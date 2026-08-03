import test from 'node:test';
import assert from 'node:assert/strict';
import {
    IMAGE_CAPTURE_BUCKET,
    uploadAndEnqueueImageCapture,
    validateImageUpload
} from '../../server/services/imageCaptureService.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test('image validation verifies MIME type and file signature', () => {
    const image = validateImageUpload(png, 'image/png', '測試/圖片.png');
    assert.equal(image.contentType, 'image/png');
    assert.equal(image.extension, 'png');
    assert.equal(image.originalFilename, '測試_圖片.png');

    assert.throws(
        () => validateImageUpload(Buffer.from('not an image'), 'image/png', 'fake.png'),
        /valid JPEG, PNG, WebP, or GIF/
    );
});

test('image intake uploads to a deterministic private path before durable enqueue', async () => {
    const calls = [];
    const fakeSupabase = {
        storage: {
            from: (bucket) => ({
                upload: async (storagePath, body, options) => {
                    calls.push({ type: 'upload', bucket, storagePath, body, options });
                    return { error: null };
                }
            })
        },
        rpc: (name, params) => ({
            single: async () => {
                calls.push({ type: 'rpc', name, params });
                return {
                    data: {
                        id: '11111111-1111-4111-8111-111111111111',
                        input_type: 'image',
                        status: 'accepted',
                        correlation_id: params.p_correlation_id
                    },
                    error: null
                };
            }
        })
    };

    const capture = await uploadAndEnqueueImageCapture({
        userId: '22222222-2222-4222-8222-222222222222',
        buffer: png,
        contentType: 'image/png',
        originalFilename: 'diagram.png',
        idempotencyKey: 'stable-image-key',
        correlationId: 'image-correlation',
        priority: 50,
        requestMeta: { auth_type: 'supabase_jwt' }
    }, fakeSupabase);

    assert.equal(capture.input_type, 'image');
    assert.equal(calls[0].type, 'upload');
    assert.equal(calls[0].bucket, IMAGE_CAPTURE_BUCKET);
    assert.match(calls[0].storagePath, /^22222222-2222-4222-8222-222222222222\/captures\/[a-f0-9]{64}\.png$/);
    assert.equal(calls[1].name, 'enqueue_collection_image_capture_request');
    assert.equal(calls[1].params.p_storage_path, calls[0].storagePath);
    assert.equal(calls[1].params.p_content_type, 'image/png');
});

test('image intake removes a newly uploaded object when durable enqueue fails', async () => {
    const calls = [];
    const fakeSupabase = {
        storage: {
            from: (bucket) => ({
                upload: async (storagePath) => {
                    calls.push({ type: 'upload', bucket, storagePath });
                    return { error: null };
                },
                remove: async (storagePaths) => {
                    calls.push({ type: 'remove', bucket, storagePaths });
                    return { error: null };
                }
            })
        },
        rpc: () => ({
            single: async () => ({ data: null, error: { message: 'queue unavailable' } })
        })
    };

    await assert.rejects(
        uploadAndEnqueueImageCapture({
            userId: '22222222-2222-4222-8222-222222222222',
            buffer: png,
            contentType: 'image/png',
            originalFilename: 'diagram.png',
            idempotencyKey: 'cleanup-after-enqueue-failure',
            correlationId: 'image-correlation'
        }, fakeSupabase),
        /Image capture enqueue failed: queue unavailable/
    );

    assert.deepEqual(calls.map((call) => call.type), ['upload', 'remove']);
    assert.deepEqual(calls[1].storagePaths, [calls[0].storagePath]);
});

test('image intake never removes an object that already existed before enqueue', async () => {
    const calls = [];
    const fakeSupabase = {
        storage: {
            from: () => ({
                upload: async () => ({ error: { statusCode: 409, message: 'already exists' } }),
                remove: async (storagePaths) => {
                    calls.push(storagePaths);
                    return { error: null };
                }
            })
        },
        rpc: () => ({
            single: async () => ({ data: null, error: { message: 'queue unavailable' } })
        })
    };

    await assert.rejects(
        uploadAndEnqueueImageCapture({
            userId: '22222222-2222-4222-8222-222222222222',
            buffer: png,
            contentType: 'image/png',
            originalFilename: 'diagram.png',
            idempotencyKey: 'existing-object-must-survive',
            correlationId: 'image-correlation'
        }, fakeSupabase),
        /Image capture enqueue failed: queue unavailable/
    );

    assert.deepEqual(calls, []);
});
