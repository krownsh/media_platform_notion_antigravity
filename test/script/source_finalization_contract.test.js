import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const sql = fs.readFileSync(path.join(projectRoot, 'database', 'deployments', 'stage_b_source_finalization.sql'), 'utf8');
const aggregatorSql = fs.readFileSync(path.join(projectRoot, 'database', 'deployments', 'schema_aggregator.sql'), 'utf8');
const serverSource = fs.readFileSync(path.join(projectRoot, 'server', 'index.js'), 'utf8');
const orchestratorSource = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'orchestrator.js'), 'utf8');
const completeItemSource = fs.readFileSync(path.join(projectRoot, 'scripts', 'agent-sdk', 'complete-item.js'), 'utf8');
const routeStateSource = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'outboxRouteStateService.js'), 'utf8');

test('Stage B finalization is one database transaction with an idempotent source outbox', () => {
    assert.match(sql, /^begin;/m);
    assert.match(sql, /create table if not exists public\.collection_capture_outbox/);
    assert.match(sql, /unique \(user_id, idempotency_key\)/);
    assert.match(sql, /create or replace function public\.finalize_collection_capture/);
    assert.match(sql, /on conflict \(user_id, original_url\) do update/);
    assert.match(sql, /delete from public\.collection_post_analysis/);
    assert.match(sql, /delete from public\.collection_post_media/);
    assert.match(sql, /delete from public\.collection_post_comments/);
    assert.match(sql, /'source\.ingested\.v1'/);
    assert.match(sql, /on conflict \(user_id, idempotency_key\) do nothing/);
    assert.match(sql, /commit;/);
});

test('outbox finalization stays service-role-only and is called after crawler data is ready', () => {
    assert.match(sql, /security invoker/);
    assert.match(sql, /revoke all on table public\.collection_capture_outbox from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.finalize_collection_capture[\s\S]+to service_role/);
    assert.match(serverSource, /rpc\('finalize_collection_capture'/);
    assert.match(serverSource, /p_correlation_id: correlationId/);
    assert.match(serverSource, /normalizeCapturePlatform\(data\.platform\)/);
    assert.doesNotMatch(orchestratorSource, /data\.dbId\s*=/);
});

test('all current schema sources agree that source_domains is a text array', () => {
    assert.match(sql, /source_domains text\[\]/);
    assert.match(aggregatorSql, /source_domains TEXT\[\]/);
    assert.doesNotMatch(aggregatorSql, /source_domains JSONB/);
});

test('interactive completion finalizes one route and preserves the shared outbox lifecycle', () => {
    assert.match(sql, /status text not null default 'pending' check \(status in \('pending', 'processing', 'sent', 'failed'\)\)/);
    assert.match(completeItemSource, /persistOutboxRouteTransition/);
    assert.match(completeItemSource, /<route_type>/);
    assert.match(routeStateSource, /updated_at/);
    assert.match(routeStateSource, /deriveOutboxStatus/);
    assert.doesNotMatch(completeItemSource, /status: 'sent'/);
    assert.doesNotMatch(completeItemSource, /status: 'processed'/);
    assert.doesNotMatch(completeItemSource, /processed_at|error_message/);
});
