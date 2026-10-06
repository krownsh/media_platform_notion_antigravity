import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appPath = new URL('../../src/App.jsx', import.meta.url);
const pagePath = new URL('../../src/pages/OwnerPostPage.jsx', import.meta.url);

test('owner source reader is reachable through a protected UI route', async () => {
  const [app, page] = await Promise.all([readFile(appPath, 'utf8'), readFile(pagePath, 'utf8')]);

  assert.match(app, /import OwnerPostPage from '\.\/pages\/OwnerPostPage';/);
  assert.match(app, /<Route path="\/post\/:postId"/);
  assert.match(page, /const \{ postId \} = useParams\(\)/);
  assert.match(page, /尚待你確認的候選/);
});
