import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexPath = new URL('../../server/index.js', import.meta.url);
const environmentExamplePath = new URL('../../server/.env.example', import.meta.url);

test('knowledge map route is JWT-protected, delegates owner scope to the DB reader, and exposes no write method', async () => {
  const [source, environmentExample] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(environmentExamplePath, 'utf8')
  ]);

  assert.match(source, /app\.use\('\/api\/knowledge-map', requireSupabaseJwt\)/);
  assert.match(source, /app\.get\('\/api\/knowledge-map\/:collectionId'/);
  assert.match(source, /loadKnowledgeMap\(\{\s*collectionId: req\.params\.collectionId,\s*userId: getAuthenticatedUserId\(req\),\s*supabaseClient: supabase\s*}\)/);
  assert.doesNotMatch(source, /KNOWLEDGE_MAP_OWNER_ID/);
  assert.doesNotMatch(environmentExample, /KNOWLEDGE_MAP_(OWNER_ID|RUN_DIR)/);
  assert.doesNotMatch(source, /app\.(post|put|patch|delete)\('\/api\/knowledge-map/);
});
