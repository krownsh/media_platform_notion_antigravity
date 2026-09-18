import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexPath = new URL('../../server/index.js', import.meta.url);

test('knowledge-space API is JWT-protected, owner-scoped, and has no writer route', async () => {
  const source = await readFile(indexPath, 'utf8');

  assert.match(source, /import \{ listKnowledgeSpaces, loadKnowledgeSpace \} from '\.\/services\/knowledgeSpaceService\.js';/);
  assert.match(source, /app\.use\('\/api\/knowledge-spaces', requireSupabaseJwt\)/);
  assert.match(source, /app\.get\('\/api\/knowledge-spaces', async \(req, res\) =>/);
  assert.match(source, /listKnowledgeSpaces\(\{\s*userId: getAuthenticatedUserId\(req\),\s*supabaseClient: supabase\s*}\)/);
  assert.match(source, /app\.get\('\/api\/knowledge-spaces\/:spaceId'/);
  assert.match(source, /loadKnowledgeSpace\(\{\s*spaceId: req\.params\.spaceId,\s*userId: getAuthenticatedUserId\(req\),\s*supabaseClient: supabase\s*}\)/);
  assert.doesNotMatch(source, /app\.(post|put|patch|delete)\('\/api\/knowledge-spaces/);
});
