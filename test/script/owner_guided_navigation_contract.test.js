import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('normal navigation exposes only Inbox, Library, Topics, and Projects', async () => {
    const [app, layout, home, detail, design] = await Promise.all([
        readFile(new URL('../../src/App.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/components/Layout.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/pages/HomePage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/pages/OwnerPostPage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../docs/architecture/owner-guided-navigation-cutover-design.md', import.meta.url), 'utf8')
    ]);
    assert.match(app, /OwnerPostPage/);
    assert.match(app, /path="\/view-all" element={<Navigate to="\/search" replace \/>}/);
    assert.match(app, /path="\/collection\/:collectionId" element={<Navigate to="\/search" replace \/>}/);
    assert.match(layout, /label="Library 搜尋"/);
    assert.doesNotMatch(layout, /新增資料夾/);
    assert.doesNotMatch(layout, /趨勢看板/);
    assert.match(home, /未接受前，不會寫進正式知識/);
    assert.doesNotMatch(home, /CollectionBoard/);
    assert.match(detail, /尚待你確認的候選/);
    assert.match(design, /Physical removal is deferred to M7/);
});
