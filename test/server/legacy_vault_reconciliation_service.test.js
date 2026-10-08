import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileLegacyPostCandidates } from '../../server/services/legacyVaultReconciliationService.js';

test('reconciliation groups duplicate legacy files by post ID and only marks an exact production match migratable', async () => {
    const result = await reconcileLegacyPostCandidates({
        inventory: [
            { relativePath: 'wiki/threads/a.md', candidateKind: 'post_candidate', postId: 'post-1', sha256: 'old-a' },
            { relativePath: 'wiki/domains/a.md', candidateKind: 'post_candidate', postId: 'post-1', sha256: 'old-b' },
            { relativePath: 'wiki/threads/missing.md', candidateKind: 'post_candidate', postId: 'post-2', sha256: 'old-c' }
        ],
        loadPosts: async ids => {
            assert.deepEqual(ids, ['post-1', 'post-2']);
            return [{ id: 'post-1', original_url: 'https://example.test/source', content_hash: 'source-hash', title: 'Matched post' }];
        }
    });

    assert.deepEqual(result, [
        {
            postId: 'post-1',
            status: 'ready_for_owner_review',
            post: { id: 'post-1', original_url: 'https://example.test/source', content_hash: 'source-hash', title: 'Matched post' },
            legacyPaths: ['wiki/domains/a.md', 'wiki/threads/a.md'],
            legacyHashes: ['old-b', 'old-a']
        },
        {
            postId: 'post-2',
            status: 'unmatched_post',
            post: null,
            legacyPaths: ['wiki/threads/missing.md'],
            legacyHashes: ['old-c']
        }
    ]);
});
