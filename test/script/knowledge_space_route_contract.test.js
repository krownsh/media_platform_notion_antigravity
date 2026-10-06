import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexPath = new URL('../../server/index.js', import.meta.url);

test('retired knowledge-space API is not mounted in the normal server surface', async () => {
  const source = await readFile(indexPath, 'utf8');

  assert.doesNotMatch(source, /knowledgeSpaceService|\/api\/knowledge-spaces/);
  assert.match(source, /app\.use\('\/api\/owner-library', requireSupabaseJwt, ownerLibraryRouter\)/);
});
