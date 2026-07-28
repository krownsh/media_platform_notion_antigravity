import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '../..');
const sql = fs.readFileSync(
  path.join(projectRoot, 'database', 'deployments', 'stage_c_content_studio.sql'),
  'utf8'
);

test('Content Studio deployment keeps draft storage tenant-aware, idempotent and service-role-only', () => {
  assert.match(sql, /create table if not exists public\.content_assets/);
  assert.match(sql, /create table if not exists public\.content_revisions/);
  assert.match(sql, /create table if not exists public\.content_evidence_links/);
  assert.match(sql, /user_id uuid not null references auth\.users\(id\)/);
  assert.match(sql, /constraint content_assets_user_source_format_unique unique \(user_id, source_id, format\)/);
  assert.match(sql, /constraint content_revisions_asset_idempotency_unique unique \(content_asset_id, idempotency_key\)/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /revision\.revision_number/);
  assert.match(sql, /on conflict on constraint content_evidence_links_unique do nothing/);
  assert.doesNotMatch(sql, /select id, revision_number into/);
  assert.match(sql, /revoke all on function public\.store_content_draft[\s\S]+from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.store_content_draft[\s\S]+to service_role/);
  assert.match(sql, /with check \(\(select auth\.uid\(\)\) = user_id\)/);
});
