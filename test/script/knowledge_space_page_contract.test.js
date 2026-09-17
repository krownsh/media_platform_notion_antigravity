import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appPath = new URL('../../src/App.jsx', import.meta.url);
const pagePath = new URL('../../src/pages/KnowledgeSpacePage.jsx', import.meta.url);

test('knowledge-space reader is reachable through a protected UI route', async () => {
  const [app, page] = await Promise.all([readFile(appPath, 'utf8'), readFile(pagePath, 'utf8')]);

  assert.match(app, /import KnowledgeSpacePage from '\.\/pages\/KnowledgeSpacePage';/);
  assert.match(app, /<Route path="\/knowledge-spaces\/:spaceId"/);
  assert.match(app, /<KnowledgeSpacePage \/>/);
  assert.match(page, /const \{ spaceId \} = useParams\(\)/);
  assert.match(page, /<KnowledgeSpaceMap spaceId=\{spaceId\} \/>/);
});
