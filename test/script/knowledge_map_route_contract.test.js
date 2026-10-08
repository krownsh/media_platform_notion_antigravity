import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexPath = new URL('../../server/index.js', import.meta.url);
const ownerLibraryRoutePath = new URL('../../server/routes/ownerLibraryRoutes.js', import.meta.url);

test('owner Library routes are JWT-protected and route only explicit manual organization actions to owner services', async () => {
  const [source, route] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(ownerLibraryRoutePath, 'utf8')
  ]);

  assert.match(source, /app\.use\('\/api\/owner-library', requireSupabaseJwt, ownerLibraryRouter\)/);
  assert.match(route, /router\.get\('\/posts\/:postId'/);
  assert.match(route, /loadPost\(\{ userId, postId: req\.params\.postId }\)/);
  assert.match(route, /router\.post\('\/folders'/);
  assert.match(route, /createFolder\(\{ userId, name: req\.body\?\.name }\)/);
  assert.match(route, /router\.patch\('\/posts\/:postId\/folder'/);
  assert.match(route, /setFolder\(\{ userId, postId: req\.params\.postId, collectionId: req\.body\?\.collection_id \?\? null }\)/);
  assert.doesNotMatch(route, /router\.(put|delete)\(/);
});
