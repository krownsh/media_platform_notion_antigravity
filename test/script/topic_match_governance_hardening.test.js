import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
    new URL('../../database/deployments/stage_q_topic_match_governance_hardening.sql', import.meta.url),
    'utf8'
).toLowerCase();
const existingDeploymentPatch = fs.readFileSync(
    new URL('../../database/deployments/stage_q_1_preserve_user_topic_match_decisions.sql', import.meta.url),
    'utf8'
).toLowerCase();
const sourceOwnershipPatch = fs.readFileSync(
    new URL('../../database/deployments/stage_q_2_enforce_topic_match_source_ownership.sql', import.meta.url),
    'utf8'
).toLowerCase();
const autonomousService = fs.readFileSync(
    new URL('../../server/services/autonomousKnowledgeService.js', import.meta.url),
    'utf8'
);
const remoteService = fs.readFileSync(
    new URL('../../server/services/codexRemotePreprocessService.js', import.meta.url),
    'utf8'
);

test('Stage Q keeps non-user agent matches suggested and checks Topic ownership', () => {
    assert.match(migration, /new\.matched_by\s*=\s*'agent'/);
    assert.match(migration, /new\.decision_source\s*<>\s*'user'/);
    assert.match(migration, /topic\.user_id\s*=\s*new\.user_id/);
    assert.match(migration, /topic\.origin\s*=\s*'user'/);
    assert.match(migration, /topic\.status\s*=\s*'active'/);
    assert.match(migration, /new\.status\s*:=\s*'suggested'/);
    assert.match(migration, /new\.decision_source\s*:=\s*'agent'/);
});

test('Stage Q rejects a source post owned by another user in fresh and patched deployments', () => {
    for (const deployment of [migration, sourceOwnershipPatch]) {
        assert.match(deployment, /from\s+public\.collection_posts\s+source/);
        assert.match(deployment, /source\.id\s*=\s*new\.source_id/);
        assert.match(deployment, /source\.user_id\s*=\s*new\.user_id/);
        assert.match(deployment, /topic source matches require a user-owned source post/);
    }
});

test('Stage Q preserves an accepted or rejected user decision atomically during agent upsert conflict', () => {
    assert.match(migration, /tg_op\s*=\s*'update'/);
    assert.match(migration, /old\.decision_source\s*=\s*'user'/);
    assert.match(migration, /old\.status\s+in\s*\('accepted',\s*'rejected'\)/);
    assert.match(migration, /return\s+old/);
    assert.match(existingDeploymentPatch, /tg_op\s*=\s*'update'/);
    assert.match(existingDeploymentPatch, /old\.decision_source\s*=\s*'user'/);
    assert.match(existingDeploymentPatch, /old\.status\s+in\s*\('accepted',\s*'rejected'\)/);
    assert.match(existingDeploymentPatch, /return\s+old/);
});

test('local and remote preprocess cannot silently accept an agent Topic match', () => {
    assert.match(autonomousService, /status:\s*'suggested'/);
    assert.match(autonomousService, /decision_source:\s*'agent'/);
    assert.match(autonomousService, /topic\.origin\s*!==\s*'user'/);
    assert.match(remoteService, /topic:\s*null/);
    assert.match(remoteService, /relation:\s*null/);
});

test('folder routing is isolated from Topic persistence and aggregate writes', () => {
    const folderRouting = autonomousService.slice(
        autonomousService.indexOf('export async function persistFolderDecision'),
        autonomousService.length
    );
    assert.doesNotMatch(folderRouting, /collection_topics/);
    assert.doesNotMatch(folderRouting, /collection_topic_source_matches/);
    assert.doesNotMatch(folderRouting, /rebuildTopicKnowledgeAggregate/);
});
