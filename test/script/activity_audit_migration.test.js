import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Stage U creates an append-only owner-readable activity event log', async () => {
    const sql = await readFile(new URL('../../database/deployments/stage_u_activity_audit_log.sql', import.meta.url), 'utf8');

    assert.match(sql, /create table if not exists public\.collection_activity_events/i);
    assert.match(sql, /event_type text not null/);
    assert.match(sql, /event_result text not null/);
    assert.match(sql, /created_at timestamptz not null default now\(\)/);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /auth\.uid\(\).*user_id/i);
    assert.match(sql, /grant select, insert on table public\.collection_activity_events to service_role/i);
    assert.match(sql, /collection_activity_events_user_created_idx/i);
    assert.doesNotMatch(sql, /\bupdate\s+public\.collection_post_workflows\b/i);
    assert.doesNotMatch(sql, /\bdelete\s+from\s+public\.collection_post_workflows\b/i);
});
