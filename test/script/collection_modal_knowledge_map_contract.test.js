import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const modalPath = new URL('../../src/components/CollectionModal.jsx', import.meta.url);

test('opening a collection from the board renders that collection knowledge map above its post cards', async () => {
  const source = await readFile(modalPath, 'utf8');

  assert.match(source, /import CollectionKnowledgeMap from ['"]\.\/CollectionKnowledgeMap['"];/);
  assert.match(source, /<CollectionKnowledgeMap\s+collectionId=\{collection\.id\}\s*\/>/);

  const mapPosition = source.indexOf('<CollectionKnowledgeMap');
  const postGridPosition = source.indexOf('<SortableContext');
  assert.ok(mapPosition >= 0 && mapPosition < postGridPosition, 'knowledge map must appear before the collection post grid');
});
