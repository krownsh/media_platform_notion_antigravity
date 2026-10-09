import assert from 'node:assert/strict';
import test from 'node:test';
import { selectLegacyPostIds } from '../../scripts/maintenance/import-legacy-vault-case-files.js';

test('selects every unique post-backed legacy candidate only under explicit full-import mode', () => {
    const inventory = [
        { candidateKind: 'post_candidate', postId: 'post-1' },
        { candidateKind: 'post_candidate', postId: 'post-2' },
        { candidateKind: 'topic_candidate', postId: null },
        { candidateKind: 'post_candidate', postId: 'post-1' },
        { candidateKind: 'post_candidate', postId: null }
    ];
    assert.deepEqual(selectLegacyPostIds({ inventory, importAll: true }), ['post-1', 'post-2']);
});

test('keeps ordinary explicit imports capped at the small review batch size', () => {
    assert.throws(
        () => selectLegacyPostIds({ requestedIds: Array.from({ length: 16 }, (_, index) => `post-${index}`) }),
        /1-15 IDs/
    );
});
