import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('normal navigation keeps owner-guided workflow while restoring library compatibility', async () => {
    const [app, layout, home, detail, analytics, allPosts, card, design] = await Promise.all([
        readFile(new URL('../../src/App.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/components/Layout.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/pages/HomePage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/pages/OwnerPostPage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/pages/AnalyticsPage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/pages/AllPostsPage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/components/LibraryPostCard.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../docs/architecture/owner-guided-navigation-cutover-design.md', import.meta.url), 'utf8')
    ]);
    assert.match(app, /OwnerPostPage/);
    assert.match(app, /AllPostsPage/);
    assert.match(app, /AnalyticsPage/);
    assert.match(app, /path="\/library" element={<ProtectedRoute><LibraryPage \/><\/ProtectedRoute>}/);
    assert.match(app, /path="\/library\/:collectionId" element={<ProtectedRoute><LibraryPage \/><\/ProtectedRoute>}/);
    assert.match(app, /path="\/view-all" element={<ProtectedRoute><AllPostsPage \/><\/ProtectedRoute>}/);
    assert.match(app, /path="\/collection\/:collectionId" element={<ProtectedRoute><AllPostsPage \/><\/ProtectedRoute>}/);
    assert.match(app, /path="\/insight" element={<ProtectedRoute><AnalyticsPage \/><\/ProtectedRoute>}/);
    assert.match(layout, /label="記憶搜尋"/);
    assert.match(layout, /label="收件匣"/);
    assert.doesNotMatch(layout, /label="首頁"/);
    assert.match(layout, /label="所有貼文"/);
    assert.match(layout, /label="分析數據"/);
    assert.match(layout, /label="收藏夾"/);
    assert.match(layout, /資料夾管理/);
    assert.match(home, /未接受前，不會寫進正式知識/);
    assert.doesNotMatch(home, /CollectionBoard/);
    assert.match(detail, /尚待你確認的候選/);
    assert.match(detail, /知識與整理/);
    assert.match(detail, /留言回覆/);
    assert.match(detail, /flex-\[3\]/);
    assert.match(allPosts, /所有貼文/);
    assert.match(card, /直接選擇/);
    assert.match(card, /onMove/);
    assert.match(card, /刪除此貼文/);
    assert.match(card, /onDelete/);
    assert.match(analytics, /這個頁面只讀取資料/);
    assert.doesNotMatch(analytics, /batch-classify/);
    assert.match(design, /Physical removal of[\s\S]+is deferred to M7/);
});
