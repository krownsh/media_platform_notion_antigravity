import assert from 'node:assert/strict';
import test from 'node:test';

import {
    TRACK_STATUSES,
    normalizeParallelTracks,
    withParallelTrack
} from '../../server/services/parallelTrackService.js';

test('parallel tracks give legacy workflows independent safe defaults', () => {
    assert.deepEqual(normalizeParallelTracks({}), {
        knowledge: { status: 'pending', reason: '等待知識整理', updated_at: null },
        project_application: { status: 'not_applicable', reason: '尚未連結專案應用', updated_at: null }
    });
    assert.deepEqual([...TRACK_STATUSES], ['pending', 'processing', 'needs_review', 'completed', 'not_applicable', 'failed']);
});

test('parallel tracks discard invalid persisted statuses without losing valid sibling state', () => {
    assert.deepEqual(normalizeParallelTracks({
        parallel_tracks: {
            knowledge: { status: 'completed', reason: '已合併到既有主題', updated_at: '2026-09-15T00:00:00.000Z' },
            project_application: { status: 'sent', reason: 'technical status must not leak' }
        }
    }), {
        knowledge: { status: 'completed', reason: '已合併到既有主題', updated_at: '2026-09-15T00:00:00.000Z' },
        project_application: { status: 'not_applicable', reason: '尚未連結專案應用', updated_at: null }
    });
});

test('parallel track patch preserves unrelated context and sibling track', () => {
    const updated = withParallelTrack({
        capture: { correlation_id: 'capture-1' },
        parallel_tracks: {
            knowledge: { status: 'completed', reason: '已整理', updated_at: '2026-09-15T00:00:00.000Z' },
            project_application: { status: 'pending', reason: '等待專案評估', updated_at: null }
        }
    }, 'project_application', {
        status: 'needs_review',
        reason: '需要確認是否適用既有專案'
    }, '2026-09-15T01:00:00.000Z');

    assert.deepEqual(updated.capture, { correlation_id: 'capture-1' });
    assert.deepEqual(updated.parallel_tracks.knowledge, { status: 'completed', reason: '已整理', updated_at: '2026-09-15T00:00:00.000Z' });
    assert.deepEqual(updated.parallel_tracks.project_application, {
        status: 'needs_review', reason: '需要確認是否適用既有專案', updated_at: '2026-09-15T01:00:00.000Z'
    });
    assert.throws(() => withParallelTrack({}, 'outbox', { status: 'sent' }), /Unsupported parallel track/);
    assert.throws(() => withParallelTrack({}, 'knowledge', { status: 'sent' }), /Unsupported parallel track status/);
});
