import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Library search distinguishes accepted knowledge from opt-in candidates', async () => {
    const [page, api, migration] = await Promise.all([
        readFile(new URL('../../src/pages/SearchPage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/api/searchApi.js', import.meta.url), 'utf8'),
        readFile(new URL('../../database/deployments/stage_x_owner_guided_search.sql', import.meta.url), 'utf8')
    ]);
    assert.match(page, /包含尚未接受的候選/);
    assert.match(page, /每一筆結果都會告訴你它為什麼出現/);
    assert.match(page, /僅候選，尚未接受/);
    assert.match(api, /includeCandidates/);
    assert.match(migration, /owner_post_search_documents/);
    assert.match(migration, /search_owner_post_documents/);
    assert.match(migration, /raw_source/);
    assert.match(migration, /when q is null then raw_text/);
});
