import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../..', import.meta.url);

test('Library folder actions use the owner-scoped API rather than browser Supabase writes', async () => {
    const saga = await readFile(new URL('src/store/rootSaga.js', root), 'utf8');
    const api = await readFile(new URL('src/api/ownerLibraryApi.js', root), 'utf8');
    const routes = await readFile(new URL('server/routes/ownerLibraryRoutes.js', root), 'utf8');
    assert.match(saga, /createOwnerLibraryFolder/);
    assert.match(saga, /setOwnerLibraryFolder/);
    assert.doesNotMatch(saga, /function\* handleCreateCollection[\s\S]*?supabase\.from\('collection_collections'\)\.insert/);
    assert.doesNotMatch(saga, /function\* handleMovePostToCollection[\s\S]*?supabase\.from\('collection_posts'\)[\s\S]*?\.update\(\{ collection_id/);
    assert.match(api, /\/api\/owner-library\/folders/);
    assert.match(api, /\/api\/owner-library\/posts\/\$\{encodeURIComponent\(postId\)\}\/folder/);
    assert.match(routes, /router\.post\('\/folders'/);
    assert.match(routes, /router\.patch\('\/posts\/:postId\/folder'/);
});
