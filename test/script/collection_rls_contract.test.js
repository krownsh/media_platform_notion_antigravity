import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const deployment = fs.readFileSync(path.join(root, 'database/deployments/stage_p_collection_rls_hardening.sql'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'database/schema/schema.sql'), 'utf8');
const saga = fs.readFileSync(path.join(root, 'src/store/rootSaga.js'), 'utf8');

function sagaSection(start, end) {
    const from = saga.indexOf(`function* ${start}`);
    const to = saga.indexOf(`function* ${end}`, from);
    assert.ok(from >= 0 && to > from, `${start} section was not found`);
    return saga.slice(from, to);
}

test('Stage P enables owner-only RLS and removes anonymous table access', () => {
    assert.match(deployment, /revoke all on table public\.collection_posts, public\.collection_collections\s+from public, anon, authenticated/i);
    assert.match(deployment, /grant select, insert, update, delete on table public\.collection_posts, public\.collection_collections\s+to authenticated, service_role/i);
    assert.match(deployment, /alter table public\.collection_posts enable row level security/i);
    assert.match(deployment, /alter table public\.collection_collections enable row level security/i);
    assert.match(deployment, /for update to authenticated[\s\S]+with check/i);
    assert.doesNotMatch(deployment, /to public/i);
});

test('Stage P prevents cross-tenant collection assignment at relation and policy layers', () => {
    assert.match(deployment, /collection_posts_collection_owner_fkey[\s\S]+foreign key \(collection_id, user_id\)[\s\S]+references public\.collection_collections \(id, user_id\)[\s\S]+on delete set null/i);
    assert.match(deployment, /Stage P blocked: collection_posts contains cross-tenant or missing collection links/i);
    assert.match(deployment, /collection_id is null[\s\S]+collection\.id = collection_posts\.collection_id[\s\S]+collection\.user_id = \(select auth\.uid\(\)\)/i);
});

test('reference schema places the tenant-aware key on Collections, not post comments', () => {
    const collections = schema.slice(
        schema.indexOf('CREATE TABLE public.collection_collections'),
        schema.indexOf('COMMENT ON TABLE public.collection_collections')
    );
    const comments = schema.slice(
        schema.indexOf('CREATE TABLE public.collection_post_comments'),
        schema.indexOf('COMMENT ON TABLE public.collection_post_comments')
    );
    assert.match(collections, /collection_collections_id_user_unique UNIQUE \(id, user_id\)/);
    assert.doesNotMatch(comments, /collection_collections_id_user_unique/);
});

test('browser mutations include the authenticated tenant in their target filter', () => {
    assert.match(sagaSection('handleDeletePost', 'handleCreateCollection'), /\.eq\('id', postId\)\s*\.eq\('user_id', user\.id\)/);
    assert.match(sagaSection('handleDeleteCollection', 'handleMovePostToCollection'), /\.eq\('collection_id', collectionId\)\s*\.eq\('user_id', user\.id\)/);
    assert.match(sagaSection('handleDeleteCollection', 'handleMovePostToCollection'), /\.eq\('id', collectionId\)\s*\.eq\('user_id', user\.id\)/);
    assert.match(sagaSection('handleMovePostToCollection', 'handleUpdateCollectionName'), /\.eq\('id', postId\)\s*\.eq\('user_id', user\.id\)/);
});
