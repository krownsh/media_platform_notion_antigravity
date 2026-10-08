import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = new URL('../../database/deployments/stage_x_owner_local_media_knowledge_vault.sql', import.meta.url);

test('local media knowledge records are additive, owner-scoped, and browser read-only', async () => {
    const sql = await readFile(migration, 'utf8');
    for (const table of [
        'owner_local_note_manifests',
        'owner_local_note_events',
        'owner_local_note_change_candidates'
    ]) {
        assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
        assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
        assert.match(sql, new RegExp(`create policy "Owners view their local media ${table}" on public\\.${table} for select to authenticated`));
    }
    assert.match(sql, /note_kind text not null check \(note_kind in \('post_case_file', 'topic_note', 'project_note'\)\)/);
    assert.match(sql, /sync_state text not null default 'pending' check \(sync_state in \('pending', 'synchronized', 'local_change_pending', 'conflict', 'failed'\)\)/);
    assert.match(sql, /event_payload jsonb not null default '\{\}'::jsonb check \(jsonb_typeof\(event_payload\) = 'object'\)/);
    assert.match(sql, /comment on column public\.owner_local_note_events\.event_payload is/);
    assert.match(sql, /create or replace function public\.append_owner_local_note_event/);
    assert.match(sql, /LOCAL_NOTE_MANIFEST_NOT_FOUND/);
    assert.match(sql, /max\(sequence\), 0\) \+ 1/);
    assert.match(sql, /grant select on table public\.owner_local_note_manifests,[\s\S]+owner_local_note_change_candidates to authenticated/);
    assert.match(sql, /grant select, insert, update, delete on table public\.owner_local_note_manifests,[\s\S]+owner_local_note_change_candidates to service_role/);
    assert.doesNotMatch(sql, /update public\.collection_posts/);
});

test('appending an event never claims it was already written to the local file', async () => {
    const sql = await readFile(migration, 'utf8');
    const rpc = sql.slice(sql.indexOf('create or replace function public.append_owner_local_note_event'));
    assert.match(rpc, /set version = version \+ 1,/);
    assert.doesNotMatch(rpc, /set last_written_event_sequence\s*=/);
});
