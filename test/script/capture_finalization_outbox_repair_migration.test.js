import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const current = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(current), '..', '..');
const repairPath = path.join(root, 'database/deployments/stage_z_capture_finalization_outbox_repair.sql');

function readRepair() {
  return fs.readFileSync(repairPath, 'utf8');
}

test('capture finalization repair always returns a durable outbox event id', () => {
  const sql = readRepair();

  assert.match(sql, /create or replace function public\.finalize_collection_capture/i);
  assert.match(sql, /insert into public\.collection_capture_outbox/i);
  assert.match(sql, /on conflict \(user_id, idempotency_key\) do nothing/i);
  assert.match(sql, /select id into v_outbox_event_id\s+from public\.collection_capture_outbox/i);
  assert.match(sql, /return query select v_post_id, v_outbox_event_id, v_outbox_event_created/i);
  assert.doesNotMatch(sql, /return query select v_post_id, null::uuid, false/i);
});

test('capture finalization repair keeps finalizer restricted to service_role', () => {
  const sql = readRepair();

  assert.match(sql, /revoke all on function public\.finalize_collection_capture[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.finalize_collection_capture[\s\S]*to service_role/i);
});
