import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationPath = path.join(projectRoot, 'database/deployments/stage_z_legacy_collection_physical_retirement.sql');

test('physical retirement is collection-only, explicit, and never uses cascade', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = sql.replace(/^--.*$/gm, '');

    assert.match(sql, /drop table if exists public\.collection_capture_outbox/i);
    assert.match(sql, /drop table if exists public\.collection_post_workflows/i);
    assert.match(sql, /drop table if exists public\.collection_post_analysis/i);
    assert.match(sql, /drop table if exists public\.collection_post_search_documents/i);
    assert.match(sql, /drop table if exists public\.collection_topics/i);
    assert.match(sql, /drop table if exists public\.collection_projects/i);
    assert.match(sql, /drop table if exists public\.source_taxonomy_category_proposals/i);
    assert.match(sql, /alter table public\.collection_capture_requests[\s\S]*drop column if exists outbox_event_id/i);
    assert.match(sql, /alter table public\.owner_local_note_manifests[\s\S]*drop column if exists workflow_id/i);
    assert.doesNotMatch(statements, /^\s*(drop|alter)\b.*\bcascade\b/im);
    assert.doesNotMatch(statements, /\bstock[_a-z]*\b/i);
    assert.doesNotMatch(statements, /drop table if exists public\.collection_posts/i);
    assert.doesNotMatch(statements, /drop table if exists public\.collection_collections/i);
    assert.doesNotMatch(statements, /drop table if exists public\.collection_user_annotations/i);
    assert.doesNotMatch(statements, /drop table if exists public\.owner_/i);
});
