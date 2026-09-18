import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appPath = new URL('../../src/App.jsx', import.meta.url);
const pagePath = new URL('../../src/pages/KnowledgeSpacesPage.jsx', import.meta.url);
const layoutPath = new URL('../../src/components/Layout.jsx', import.meta.url);

test('knowledge-space index has a protected list route and discoverable desktop/mobile navigation', async () => {
  const [app, page, layout] = await Promise.all([
    readFile(appPath, 'utf8'),
    readFile(pagePath, 'utf8'),
    readFile(layoutPath, 'utf8')
  ]);

  assert.match(app, /import KnowledgeSpacesPage from '\.\/pages\/KnowledgeSpacesPage';/);
  assert.match(app, /<Route path="\/knowledge-spaces"/);
  assert.match(app, /<KnowledgeSpacesPage \/>/);
  assert.match(page, /authenticatedFetch\(`\$\{API_BASE_URL\}\/api\/knowledge-spaces`\)/);
  assert.match(page, /navigate\(`\/knowledge-spaces\/\$\{space\.id\}`\)/);
  assert.match(page, /知識地圖/);

  const navigationEntries = layout.match(/label="知識地圖"/g) || [];
  assert.equal(navigationEntries.length, 2, 'knowledge-space entry must exist in both desktop and mobile navigation');
  assert.match(layout, /navigate\('\/knowledge-spaces'\)/);
  assert.match(layout, /active=\{location\.pathname\.startsWith\('\/knowledge-spaces'\)\}/);
});
