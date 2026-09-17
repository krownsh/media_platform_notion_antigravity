import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../../database/deployments/stage_w2_knowledge_space_collections.sql', import.meta.url);

test('knowledge-space scope uses a tenant-aware M:N relation to existing collections', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /create table public\.knowledge_space_collections/i);
  assert.match(sql, /primary key \(space_id, collection_id\)/i);
  assert.match(sql, /unique \(id, user_id\)/i);
  assert.match(sql, /foreign key \(space_id, user_id\)[\s\S]{0,220}references public\.knowledge_spaces \(id, user_id\)/i);
  assert.match(sql, /foreign key \(collection_id, user_id\)[\s\S]{0,220}references public\.collection_collections \(id, user_id\)/i);
  assert.match(sql, /alter table public\.knowledge_space_collections enable row level security/i);
  assert.match(sql, /create policy knowledge_space_collections_owner_select/i);
  assert.doesNotMatch(sql, /insert into public\.collection_collections/i);
  assert.doesNotMatch(sql, /update public\.collection_posts/i);
});
