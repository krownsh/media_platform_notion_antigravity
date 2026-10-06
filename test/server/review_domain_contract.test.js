import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sql = fs.readFileSync(path.join(root, 'database/deployments/stage_x_owner_guided_review_domain.sql'), 'utf8');
const routeSource = fs.readFileSync(path.join(root, 'server/routes/reviewRoutes.js'), 'utf8');

test('review schema records candidates, owner decisions, checkpoints, and audit evidence with RLS', () => {
    for (const table of [
        'owner_review_packets',
        'owner_review_proposals',
        'owner_review_approvals',
        'owner_review_checkpoints',
        'owner_review_audit_events'
    ]) {
        assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
        assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    }
    assert.match(sql, /unique \(user_id, source_revision_id\)/);
    assert.match(sql, /unique \(user_id, idempotency_key\)/);
    assert.match(sql, /REVIEW_VERSION_CONFLICT/);
    assert.match(sql, /transition_owner_review_proposal/);
    assert.match(sql, /resume_owner_review_packet/);
    assert.match(sql, /owner_review_audit_events/);
    assert.match(sql, /Owners view their review packets/);
    assert.doesNotMatch(sql, /Owners manage their review packets" on public\.owner_review_packets for all/);
});

test('review decision domain cannot mutate formal organization or knowledge records', () => {
    assert.doesNotMatch(sql, /update public\.collection_posts/);
    assert.doesNotMatch(sql, /insert into public\.collection_post_analysis/);
    assert.doesNotMatch(sql, /insert into public\.collection_topics/);
    assert.doesNotMatch(sql, /insert into public\.collection_collections/);
    assert.doesNotMatch(sql, /insert into public\.collection_projects/);
    assert.doesNotMatch(sql, /collection_capture_outbox/);
});

test('HTTP review actions require a version and translate database conflicts to 409', () => {
    assert.match(routeSource, /expected_version must be a positive integer/);
    assert.match(routeSource, /packets\/:packetId\/resume/);
    assert.match(routeSource, /isReviewConflict\(error\) \? 409/);
    assert.match(routeSource, /req\.auth\?\.userId/);
    assert.doesNotMatch(routeSource, /req\.body\?\.user_id/);
});
