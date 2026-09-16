import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const policy = fs.readFileSync(
    new URL('../../server/config/ownerCollectionTaxonomy.js', import.meta.url),
    'utf8'
);
const migration = fs.readFileSync(
    new URL('../../database/deployments/stage_q_3_remote_preprocess_folder_guard.sql', import.meta.url),
    'utf8'
).toLowerCase();

const expectedIds = [...policy.matchAll(/'([0-9a-f-]{36})'/g)].map(match => match[1]).slice(1);

test('remote preprocess uses the exact owner allowlist and mandatory 0.85 folder confidence floor', () => {
    assert.equal(expectedIds.length, 20);
    assert.match(migration, /v_folder_confidence\s+numeric\s*:=\s*0/);
    assert.match(migration, /v_folder_confidence\s*>=\s*0\.85/);
    for (const id of expectedIds) assert.match(migration, new RegExp(id));
});

test('remote preprocess assignment is tenant-scoped and null-only conditional', () => {
    assert.match(migration, /where id = v_post\.id\s+and user_id = v_post\.user_id\s+and collection_id is null/);
    assert.match(migration, /if not found then\s+v_collection := null/);
});

test('remote preprocess leaves free-text suggestions and unapproved collections unassigned', () => {
    assert.match(migration, /v_collection\.id = any\(array\[/);
    assert.match(migration, /else\s+v_collection := null/);
});
