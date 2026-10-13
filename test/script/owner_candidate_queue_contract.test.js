import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('candidate queue stays owner-guided, capped, and collection-only', () => {
    const sql = read('database/deployments/stage_y_owner_guided_candidate_queue_and_retrieval.sql');
    assert.match(sql, /owner_candidate_generation_jobs/);
    assert.match(sql, /p_limit must be between 1 and 20/);
    assert.match(sql, /rate_limit_owner_candidate_generation_run/);
    assert.match(sql, /owner_post_retrieval_terms/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /complete_owner_content_discussion_checkpoint/);
    assert.doesNotMatch(sql, /\bstock[_a-z]*/i);
    assert.doesNotMatch(sql, /collection_post_workflows|collection_capture_outbox|collection_post_analysis/);
});

test('new capture queues candidate work instead of deterministic semantic proposals', () => {
    const finalizer = read('server/services/captureFinalizationService.js');
    assert.match(finalizer, /ensureCandidateGenerationJob/);
    assert.doesNotMatch(finalizer, /prepareInitialReviewProposals/);
    assert.match(finalizer, /createOrRetryLocalPostCaseFile/);
});
