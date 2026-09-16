import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentPath = new URL('../../src/components/CollectionKnowledgeMap.jsx', import.meta.url);
const collectionPagePath = new URL('../../src/pages/ViewAllPage.jsx', import.meta.url);

test('collection knowledge map keeps every visible statement citable and exposes citation hover previews', async () => {
  const source = await readFile(componentPath, 'utf8');

  assert.match(source, /statement\.citations\.map/);
  assert.match(source, /onMouseEnter/);
  assert.match(source, /onFocus/);
  assert.match(source, /role="tooltip"/);
  assert.match(source, /navigate\(`\/post\/\$\{citation\.postId\}`\)/);
  assert.match(source, /citation\.title/);
  assert.match(source, /citation\.excerpt/);
});

test('collection page mounts the read-only knowledge map only for a selected collection', async () => {
  const source = await readFile(collectionPagePath, 'utf8');

  assert.match(source, /CollectionKnowledgeMap/);
  assert.match(source, /collectionId &&/);
});
