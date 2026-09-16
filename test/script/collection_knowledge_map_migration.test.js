import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migrationPath = path.resolve('database/deployments/stage_v_collection_knowledge_maps.sql');

test('collection knowledge map migration creates an owner-isolated, revisioned collection projection', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    assert.match(migration, /create table if not exists public\.collection_knowledge_maps/i);
    assert.match(migration, /user_id uuid not null references auth\.users\(id\) on delete cascade/i);
    assert.match(migration, /collection_id uuid not null references public\.collection_collections\(id\) on delete cascade/i);
    assert.match(migration, /statements jsonb not null default '\[\]'::jsonb/i);
    assert.match(migration, /processed_posts integer not null default 0/i);
    assert.match(migration, /total_posts integer not null default 0/i);
    assert.match(migration, /unique \(user_id, collection_id\)/i);
    assert.match(migration, /alter table public\.collection_knowledge_maps enable row level security/i);
    assert.match(migration, /for select to authenticated/i);
    assert.match(migration, /\(select auth\.uid\(\)\) = user_id/i);
    assert.doesNotMatch(migration, /grant\s+.*\bto\s+anon/i);
});
