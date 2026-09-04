import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
    new URL('../../database/deployments/stage_q_topic_match_governance_hardening.sql', import.meta.url),
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

test('local and remote preprocess cannot silently accept an agent Topic match', () => {
    assert.match(autonomousService, /status:\s*'suggested'/);
    assert.match(autonomousService, /decision_source:\s*'agent'/);
    assert.match(autonomousService, /topic\.origin\s*!==\s*'user'/);
    assert.match(remoteService, /topic:\s*null/);
    assert.match(remoteService, /relation:\s*null/);
});
