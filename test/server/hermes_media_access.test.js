import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { materializeHermesMedia } from '../../server/services/hermesMediaAccessService.js';

const OUTBOX_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const MEDIA_ID = '33333333-3333-4333-8333-333333333333';
const OBJECT_NAME = `${'a'.repeat(64)}.png`;
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function createSupabase(event, bytes = PNG_BYTES) {
    const single = async () => ({ data: event, error: null });
    const query = { select: () => query, eq: () => query, single };
    return {
        from: () => query,
        storage: {
            from: (bucket) => ({
                download: async (storagePath) => {
                    assert.equal(bucket, 'collection_capture_uploads');
                    assert.equal(storagePath, `${USER_ID}/captures/${OBJECT_NAME}`);
                    return { data: new Blob([bytes]), error: null };
                }
            })
        }
    };
}

function imageEvent(overrides = {}) {
    return {
        id: OUTBOX_ID,
        user_id: USER_ID,
        collection_posts: {
            id: '44444444-4444-4444-8444-444444444444',
            user_id: USER_ID,
            platform: 'image',
            collection_post_media: [{
                id: MEDIA_ID,
                storage_bucket: 'collection_capture_uploads',
                storage_path: `${USER_ID}/captures/${OBJECT_NAME}`,
                content_type: 'image/png',
                byte_size: PNG_BYTES.length,
                original_filename: 'receipt.png',
                ...overrides
            }]
        }
    };
}

test('Hermes materializes only the outbox-owned private image into an OS temp directory', async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'hermes-media-test-'));
    const result = await materializeHermesMedia(
        OUTBOX_ID,
        createSupabase(imageEvent()),
        { temporaryRoot }
    );

    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].local_path, path.join(temporaryRoot, OUTBOX_ID, `${MEDIA_ID}.png`));
    assert.deepEqual(await readFile(result.files[0].local_path), PNG_BYTES);
});

test('Hermes media access rejects a non-allowlisted bucket or tenant path', async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'hermes-media-test-'));
    await assert.rejects(
        materializeHermesMedia(
            OUTBOX_ID,
            createSupabase(imageEvent({ storage_bucket: 'other-private-data' })),
            { temporaryRoot }
        ),
        /outside the allowlisted/
    );
});
