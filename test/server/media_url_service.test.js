import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStoredMediaUrls } from '../../server/services/mediaUrlService.js';
import { IMAGE_CAPTURE_BUCKET } from '../../server/services/imageCaptureService.js';

test('private Storage media receives signed display URLs while public media remains unchanged', async () => {
    const signedCalls = [];
    const supabase = {
        storage: {
            from: (bucket) => ({
                createSignedUrls: async (paths, expiresIn) => {
                    signedCalls.push({ bucket, paths, expiresIn });
                    return {
                        data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })),
                        error: null
                    };
                }
            })
        }
    };
    const posts = [{
        id: 'post-1',
        user_id: '22222222-2222-4222-8222-222222222222',
        collection_post_media: [
            {
                id: 'private',
                storage_bucket: IMAGE_CAPTURE_BUCKET,
                storage_path: '22222222-2222-4222-8222-222222222222/captures/a.png',
                url: 'storage://collection_capture_uploads/22222222-2222-4222-8222-222222222222/captures/a.png'
            },
            { id: 'public', storage_bucket: null, storage_path: null, url: 'https://cdn.example/b.png' }
        ]
    }];

    const result = await resolveStoredMediaUrls(posts, supabase, 60);
    assert.equal(
        result[0].collection_post_media[0].url,
        'https://signed.example/22222222-2222-4222-8222-222222222222/captures/a.png'
    );
    assert.equal(result[0].collection_post_media[1].url, 'https://cdn.example/b.png');
    assert.deepEqual(signedCalls[0], {
        bucket: IMAGE_CAPTURE_BUCKET,
        paths: ['22222222-2222-4222-8222-222222222222/captures/a.png'],
        expiresIn: 60
    });
});

test('private media outside the capture bucket or post owner path is never signed', async () => {
    const signedCalls = [];
    const supabase = {
        storage: {
            from: (bucket) => ({
                createSignedUrls: async (paths) => {
                    signedCalls.push({ bucket, paths });
                    return { data: [], error: null };
                }
            })
        }
    };
    const posts = [{
        user_id: '22222222-2222-4222-8222-222222222222',
        collection_post_media: [
            { storage_bucket: 'other-private-bucket', storage_path: 'secret.png', url: 'storage://other-private-bucket/secret.png' },
            { storage_bucket: IMAGE_CAPTURE_BUCKET, storage_path: 'other-user/captures/a.png', url: 'storage://collection_capture_uploads/other-user/captures/a.png' }
        ]
    }];

    const result = await resolveStoredMediaUrls(posts, supabase, 60);
    assert.deepEqual(signedCalls, []);
    assert.equal(result[0].collection_post_media[0].url, null);
    assert.equal(result[0].collection_post_media[1].url, null);
});
