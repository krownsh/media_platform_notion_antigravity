import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('product no longer exposes the retired knowledge-map feature', () => {
  const app = read('../../src/App.jsx');
  const layout = read('../../src/components/Layout.jsx');
  const collectionModal = read('../../src/components/CollectionModal.jsx');
  const collectionView = read('../../src/pages/ViewAllPage.jsx');
  const server = read('../../server/index.js');

  for (const source of [app, layout, collectionModal, collectionView]) {
    assert.doesNotMatch(source, /knowledge-spaces|KnowledgeSpace|CollectionKnowledgeMap|知識地圖/);
  }
  assert.doesNotMatch(server, /\/api\/knowledge-map|\/api\/knowledge-spaces|knowledgeMapService|knowledgeSpaceService/);
});
