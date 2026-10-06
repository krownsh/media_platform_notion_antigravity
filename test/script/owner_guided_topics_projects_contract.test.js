import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = new URL('../../database/deployments/stage_x_owner_guided_topics_projects_catalog.sql', import.meta.url);

test('M4 uses independent owner-guided Topics and Catalog tables, not legacy repository-bound tables', async () => {
    const sql = await readFile(migration, 'utf8');
    for (const table of ['owner_topics', 'owner_topic_source_links', 'owner_topic_revisions', 'owner_topic_revision_citations', 'owner_project_catalog', 'owner_topic_project_references', 'owner_poc_proposals']) {
        assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
        assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    }
    assert.match(sql, /local_repository', 'remote_repository', 'non_code/);
    assert.match(sql, /REVIEW_TOPIC_DELTA_NOT_DECIDED/);
    assert.match(sql, /create or replace function public\.promote_owner_knowledge_proposal/);
    assert.match(sql, /REVIEW_PROMOTION_REQUIRED/);
    assert.doesNotMatch(sql, /insert into public\.collection_topics/);
    assert.doesNotMatch(sql, /insert into public\.collection_projects/);
});

test('M4 makes direct browser access read-only and preserves POC as a separate approval gate', async () => {
    const sql = await readFile(migration, 'utf8');
    assert.match(sql, /grant select on table public\.owner_topics,[\s\S]+owner_poc_proposals to authenticated/);
    assert.match(sql, /grant select, insert, update, delete on table public\.owner_topics,[\s\S]+owner_poc_proposals to service_role/);
    assert.match(sql, /status text not null default 'proposed' check \(status in \('proposed', 'approved', 'rejected'\)\)/);
    assert.match(sql, /approved_at timestamptz/);
});
