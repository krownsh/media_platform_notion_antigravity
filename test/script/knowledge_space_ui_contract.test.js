import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentPath = new URL('../../src/components/KnowledgeSpaceMap.jsx', import.meta.url);

test('knowledge-space UI renders concrete technical nodes and source citations instead of a summary-only card', async () => {
  const source = await readFile(componentPath, 'utf8');

  assert.match(source, /authenticatedFetch\(`\$\{API_BASE_URL\}\/api\/knowledge-spaces\//);
  assert.match(source, /node\.type/);
  assert.match(source, /node\.title/);
  assert.match(source, /node\.problem/);
  assert.match(source, /collections\.map\(\(collection\)/);
  assert.match(source, /collection\.name/);
  assert.match(source, /Object\.entries\(node\.content\)/);
  assert.match(source, /evidence\.excerpt/);
  assert.match(source, /navigate\(`\/post\/\$\{evidence\.postId\}`\)/);
  assert.match(source, /response\.status === 404/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});
