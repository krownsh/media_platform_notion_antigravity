import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentPath = new URL('../../src/components/KnowledgeSpaceMap.jsx', import.meta.url);

test('knowledge-space reader renders ordered stage journey, explicit coverage gaps, and source-backed stage nodes', async () => {
  const source = await readFile(componentPath, 'utf8');

  assert.match(source, /const \{ space, collections = \[\], nodes, stages = \[\] \} = state\.data;/);
  assert.match(source, /stage\.coverageStatus === 'gap'/);
  assert.match(source, /stage\.nodes\.map\(\(node\) =>/);
  assert.match(source, /stage\.transitions\.map\(\(transition\)/);
  assert.match(source, /其他已引用節點/);
  assert.match(source, /<Evidence key=\{`\$\{node\.id\}-\$\{evidence\.postId\}-\$\{evidenceNumber\}`\}/);
});
