import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(projectRoot, ...parts), 'utf8');

const processingSource = read('server', 'services', 'captureProcessingService.js');
const finalizationSource = read('server', 'services', 'captureFinalizationService.js');
const requestSource = read('server', 'services', 'captureRequestService.js');
const serverSource = read('server', 'index.js');
const packageManifest = read('package.json');
const cutoverSql = read('database', 'deployments', 'stage_x_owner_guided_capture_cutover.sql');
const runtimeDetachSql = read('database', 'deployments', 'stage_z_owner_guided_runtime_detach.sql');
const integrityRepairSql = read('database', 'deployments', 'stage_z_owner_guided_integrity_repair.sql');

test('new capture processing has no automatic semantic or legacy workflow dependency', () => {
    assert.doesNotMatch(processingSource, /captureAnalysisService/);
    assert.doesNotMatch(processingSource, /postWorkflowService/);
    assert.doesNotMatch(processingSource, /analyzeCapturedUrl/);
    assert.doesNotMatch(processingSource, /updateWorkflowAfterCapture/);
    assert.match(processingSource, /captureQuality: 'partial'/);
    assert.match(processingSource, /pipelineVersion: 'capture-v5-owner-guided'/);
});

test('new finalization sends only source facts and keeps search projection non-fatal', () => {
    assert.match(finalizationSource, /p_analysis: \{\}/);
    assert.doesNotMatch(finalizationSource, /persistGeneratedTitle/);
    assert.doesNotMatch(finalizationSource, /collection_post_workflows/);
    assert.doesNotMatch(finalizationSource, /collection_post_analysis \(\*\)/);
    assert.match(finalizationSource, /Search projection deferred/);
    assert.match(finalizationSource, /Review packet projection deferred/);
    assert.match(requestSource, /source_revision_id/);
    assert.match(requestSource, /p_source_revision_id/);
});

test('cutover stores immutable source revisions and blocks automatic outbox and analysis writes', () => {
    assert.match(cutoverSql, /create table if not exists public\.collection_source_revisions/);
    assert.match(cutoverSql, /unique \(user_id, correlation_id\)/);
    assert.match(cutoverSql, /capture_quality.*'complete'.*'partial'/s);
    assert.match(cutoverSql, /create or replace function public\.finalize_collection_capture/);
    assert.match(cutoverSql, /source_revision_id uuid/);
    assert.match(cutoverSql, /p_analysis must be an empty object/);
    assert.doesNotMatch(cutoverSql, /insert into public\.collection_capture_outbox/);
    assert.doesNotMatch(cutoverSql, /insert into public\.collection_post_analysis/);
    assert.doesNotMatch(cutoverSql, /delete from public\.collection_post_analysis/);
});

test('capture completion stores the source revision and accepts a null legacy outbox id', () => {
    assert.match(cutoverSql, /add column if not exists source_revision_id uuid/);
    assert.match(cutoverSql, /p_source_revision_id uuid/);
    assert.match(cutoverSql, /source_revision_id = p_source_revision_id/);
    assert.match(cutoverSql, /p_capture_quality not in \('complete', 'partial'\)/);
    assert.match(cutoverSql, /p_outbox_event_id is not null/);
});

test('active capture runtime does not expose legacy outbox or workflow identifiers', () => {
    const localKnowledgeSource = read('server', 'services', 'localMediaKnowledgeService.js');
    const localVaultSource = read('server', 'services', 'localMediaKnowledgeVaultService.js');

    assert.doesNotMatch(processingSource, /outboxEventId/);
    assert.doesNotMatch(requestSource, /outbox_event_id|p_outbox_event_id/);
    assert.doesNotMatch(localKnowledgeSource, /workflowId|workflow_id/);
    assert.doesNotMatch(localVaultSource, /workflowId|workflow_id/);
});

test('retired publishing endpoints fail closed instead of invoking an unwired publisher', () => {
    assert.match(serverSource, /COLLECTION_PUBLISHING_RETIRED/);
    assert.match(serverSource, /app\.post\('\/api\/publish\/instagram', publicationRetired\)/);
    assert.match(serverSource, /app\.post\('\/api\/publish\/threads', publicationRetired\)/);
    assert.match(serverSource, /app\.post\('\/api\/publish\/twitter', publicationRetired\)/);
    assert.doesNotMatch(serverSource, /socialMediaService/);
});

test('runtime-detach migration is collection-only and preserves the retained request evidence', () => {
    assert.match(runtimeDetachSql, /create or replace function public\.complete_owner_guided_capture_request/);
    assert.match(runtimeDetachSql, /source_revision_id = p_source_revision_id/);
    assert.doesNotMatch(runtimeDetachSql, /outbox_event_id\s*=/);
    assert.doesNotMatch(runtimeDetachSql, /\b(stock|stocks)_/i);
    assert.doesNotMatch(runtimeDetachSql, /\bdrop\s+(table|schema)/i);
    assert.doesNotMatch(runtimeDetachSql, /\bcascade\b/i);
});

test('the runnable package surface exposes only the current capture services', () => {
    assert.doesNotMatch(packageManifest, /"agent:|"outbox:|"inbox:backfill|"owner-guided:retrofit|"search:index/);
    assert.match(packageManifest, /"start": "node server\/index\.js"/);
    assert.match(packageManifest, /"worker:capture": "node server\/scripts\/workers\/run_capture_worker\.js"/);
});

test('prepared integrity repair is exact, idempotent, and collection-only', () => {
    const statements = integrityRepairSql.replace(/^--.*$/gm, '');
    assert.match(integrityRepairSql, /OWNER_GUIDED_REPAIR_EXPECTED_ONE_COMPLETE_SOURCE_WITHOUT_PACKET/);
    assert.match(integrityRepairSql, /perform public\.ensure_owner_review_packet/);
    assert.doesNotMatch(statements, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    assert.doesNotMatch(statements, /\b(stock|stocks)_/i);
    assert.doesNotMatch(statements, /\bdelete\b|\bdrop\b|\bcascade\b/i);
});
