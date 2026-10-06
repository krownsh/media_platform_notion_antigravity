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
const cutoverSql = read('database', 'deployments', 'stage_x_owner_guided_capture_cutover.sql');

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
