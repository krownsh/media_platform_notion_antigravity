import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentPath = new URL('../../src/components/KnowledgeSpaceMap.jsx', import.meta.url);

test('knowledge-space reader renders stage contracts, accepted evidence roles, and visibly separate candidates', async () => {
  const source = await readFile(componentPath, 'utf8');

  assert.match(source, /const \{ space, collections = \[\], nodes, stages = \[\] \} = state\.data;/);
  assert.match(source, /stage\.coverageStatus === 'gap'/);
  assert.match(source, /stage\.evidenceLinks\.map\(\(link\) =>/);
  assert.match(source, /stage\.proposedEvidenceLinks\.length > 0/);
  assert.match(source, /stage\.candidateNodes\.length > 0/);
  assert.match(source, /已接受的依據/);
  assert.match(source, /待確認候選/);
  assert.match(source, /舊關聯候選/);
  assert.match(source, /link\.rationale/);
  assert.match(source, /link\.applicability/);
  assert.match(source, /link\.limitation/);
  assert.match(source, /stage\.transitions\.map\(\(transition\)/);
  assert.match(source, /其他已引用節點/);
  assert.match(source, /<Evidence key=\{`\$\{node\.id\}-\$\{evidence\.postId\}-\$\{evidenceNumber\}`\}/);
});
