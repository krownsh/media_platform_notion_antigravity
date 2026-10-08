import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appPath = new URL('../../src/App.jsx', import.meta.url);
const layoutPath = new URL('../../src/components/Layout.jsx', import.meta.url);

test('retired knowledge-space index has no normal route or navigation entry', async () => {
  const [app, layout] = await Promise.all([
    readFile(appPath, 'utf8'),
    readFile(layoutPath, 'utf8')
  ]);

  assert.doesNotMatch(app, /KnowledgeSpacesPage|knowledge-spaces/);
  assert.doesNotMatch(layout, /知識地圖|knowledge-spaces/);
  assert.match(layout, /label="記憶搜尋"/);
});
