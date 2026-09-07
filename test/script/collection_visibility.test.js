import test from 'node:test';
import assert from 'node:assert/strict';

import { visibleCollections } from '../../src/utils/collectionVisibility.js';

test('legacy Hermes auto collections are hidden from interactive collection lists', () => {
  const collections = [
    { id: 'owner', description: '自己建立的收藏夾' },
    { id: 'legacy', description: 'Hermes 自動建立：舊分類' }
  ];

  assert.deepEqual(visibleCollections(collections).map(collection => collection.id), ['owner']);
});
