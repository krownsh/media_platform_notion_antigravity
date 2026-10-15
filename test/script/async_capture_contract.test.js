import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const deployment = fs.readFileSync(path.join(projectRoot, 'database', 'deployments', 'stage_e_async_capture_requests.sql'), 'utf8');
const serverSource = fs.readFileSync(path.join(projectRoot, 'server', 'index.js'), 'utf8');
const routeSource = fs.readFileSync(path.join(projectRoot, 'server', 'routes', 'captureRoutes.js'), 'utf8');
const processingSource = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'captureProcessingService.js'), 'utf8');
const processResponseSource = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'processResponseService.js'), 'utf8');

test('capture intake is durable, idempotent, and service-role-only', () => {
    assert.match(deployment, /create table if not exists public\.collection_capture_requests/);
    assert.match(deployment, /unique \(user_id, idempotency_key\)/);
    assert.match(deployment, /alter table public\.collection_capture_requests enable row level security/);
    assert.match(deployment, /revoke all on table public\.collection_capture_requests from public, anon, authenticated/);
    assert.match(deployment, /collection_capture_requests_post_id_idx/);
    assert.match(deployment, /collection_capture_requests_outbox_event_id_idx/);
    assert.doesNotMatch(deployment, /grant select, insert, update, delete/);
    assert.match(deployment, /grant execute on function public\.enqueue_collection_capture_request[\s\S]+to service_role/);
});

test('worker claim is atomic and supports expired-lease recovery', () => {
    assert.match(deployment, /for update skip locked/);
    assert.match(deployment, /request\.lease_expires_at <= now\(\)/);
    assert.match(deployment, /request\.attempt_count < request\.max_attempts/);
    assert.match(deployment, /status in \('accepted', 'extracting', 'finalized', 'degraded', 'failed'\)/);
});

test('browser intake acknowledges immediately while the established automation endpoint waits only on the same durable queue', () => {
    assert.match(serverSource, /app\.post\(['"]\/api\/process['"], requireApiAuth, createProcessUrlHandler\(\)\)/);
    assert.match(routeSource, /router\.post\(['"]\/['"], createUrlCaptureHandler\(\{ enqueue \}\)\)/);
    assert.match(routeSource, /return res\.status\(202\)\.json/);
    assert.match(processResponseSource, /enqueueCaptureRequest/);
    assert.match(processResponseSource, /getCaptureRequest/);
    assert.doesNotMatch(processResponseSource, /orchestrator|aiService|analyzeCapturedUrl|updateWorkflowAfterCapture/);
    assert.doesNotMatch(routeSource, /orchestrator|aiService/);
    assert.doesNotMatch(processingSource, /analyzeCapturedUrl|updateWorkflowAfterCapture/);
});

test('no legacy agent job control plane remains', () => {
    assert.doesNotMatch(serverSource, /\/api\/agent\/jobs|agentJobRouter/);
});
