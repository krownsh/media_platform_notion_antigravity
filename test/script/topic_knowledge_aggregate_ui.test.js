import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('source detail presents owner-accepted topic knowledge separately from candidates', async () => {
    const page = await readFile(new URL('../../src/pages/OwnerPostPage.jsx', import.meta.url), 'utf8');

    assert.match(page, /已接受的知識/);
    assert.match(page, /revision\.summary/);
    assert.match(page, /尚待你確認的候選/);
});
