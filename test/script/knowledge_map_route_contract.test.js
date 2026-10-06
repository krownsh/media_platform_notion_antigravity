import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexPath = new URL('../../server/index.js', import.meta.url);
const ownerLibraryRoutePath = new URL('../../server/routes/ownerLibraryRoutes.js', import.meta.url);

test('owner Library detail is JWT-protected, owner-scoped, and exposes no write method', async () => {
  const [source, route] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(ownerLibraryRoutePath, 'utf8')
  ]);

  assert.match(source, /app\.use\('\/api\/owner-library', requireSupabaseJwt, ownerLibraryRouter\)/);
  assert.match(route, /router\.get\('\/posts\/:postId'/);
  assert.match(route, /loadPost\(\{ userId, postId: req\.params\.postId }\)/);
  assert.doesNotMatch(route, /router\.(post|put|patch|delete)\(/);
});
