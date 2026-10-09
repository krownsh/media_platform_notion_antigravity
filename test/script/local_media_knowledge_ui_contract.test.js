import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('post detail renders the local record phase as a compact part of the existing knowledge panel', async () => {
    const [page, card, api] = await Promise.all([
        readFile(new URL('../../src/pages/OwnerPostPage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/components/LocalRecordStatusCard.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/api/localMediaKnowledgeApi.js', import.meta.url), 'utf8')
    ]);
    assert.match(page, /LocalRecordStatusCard/);
    assert.match(page, /getLocalPostRecord\(postId\)/);
    assert.match(card, /本機完整紀錄/);
    assert.match(card, /下一步：/);
    assert.match(api, /\/api\/local-records\/posts\//);
    assert.doesNotMatch(card, /window\.open|file:\/\//);
});
