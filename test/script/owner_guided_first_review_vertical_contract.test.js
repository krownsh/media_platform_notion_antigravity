import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = new URL('../../database/deployments/stage_x_owner_guided_first_review_vertical.sql', import.meta.url);

test('first review vertical promotes formal state only through its dedicated RPC', async () => {
    const sql = await readFile(migration, 'utf8');
    assert.match(sql, /create table if not exists public\.owner_post_learning_notes/);
    assert.match(sql, /create table if not exists public\.owner_source_topic_decisions/);
    assert.match(sql, /REVIEW_PROMOTION_REQUIRED/);
    assert.match(sql, /create or replace function public\.promote_owner_review_proposal/);
    assert.match(sql, /update public\.collection_posts set collection_id = v_folder_id/);
    assert.match(sql, /insert into public\.owner_post_learning_notes/);
    assert.match(sql, /insert into public\.owner_source_topic_decisions/);
    assert.match(sql, /REVIEW_NOTE_NOT_DECIDED/);
    assert.match(sql, /distinct on \(lower\(topic\)\)/);
    assert.match(sql, /grant execute on function public\.promote_owner_review_proposal[\s\S]+to service_role/);
    assert.match(sql, /revoke all on function public\.promote_owner_review_proposal[\s\S]+from public, anon, authenticated/);
    assert.match(sql, /grant select on table public\.owner_post_learning_notes, public\.owner_source_topic_decisions to authenticated/);
    assert.match(sql, /grant select, insert, update, delete on table public\.owner_post_learning_notes,[\s\S]+public\.owner_source_topic_decisions to service_role/);
});

test('first review vertical keeps the formal note and Topic decisions owner-readable only', async () => {
    const sql = await readFile(migration, 'utf8');
    assert.match(sql, /alter table public\.owner_post_learning_notes enable row level security/);
    assert.match(sql, /alter table public\.owner_source_topic_decisions enable row level security/);
    assert.match(sql, /create policy "Owners view their post learning notes"[\s\S]+for select to authenticated/);
    assert.match(sql, /create policy "Owners view their source Topic decisions"[\s\S]+for select to authenticated/);
    assert.doesNotMatch(sql, /for all to authenticated/);
});
