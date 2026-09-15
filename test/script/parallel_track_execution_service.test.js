import assert from 'node:assert/strict';
import test from 'node:test';

import { executeParallelTracks } from '../../server/services/parallelTrackExecutionService.js';

test('knowledge failure is isolated and project-application research suggestion remains reviewable', async () => {
  const result = await executeParallelTracks({ preserved: { key: 'value' } }, {
    knowledge: async () => { throw new Error('topic persistence unavailable'); },
    project_application: async () => ({
      status: 'needs_review',
      reason: '已找到 1 個已接受主題，可確認是否建立專案應用研究。',
      details: { accepted_topic_ids: ['topic-1'] }
    })
  }, '2026-09-15T00:00:00.000Z');

  assert.equal(result.context.preserved.key, 'value');
  assert.equal(result.context.parallel_tracks.knowledge.status, 'failed');
  assert.match(result.context.parallel_tracks.knowledge.reason, /topic persistence unavailable/);
  assert.equal(result.context.parallel_tracks.project_application.status, 'needs_review');
  assert.equal(result.outcomes.knowledge.ok, false);
  assert.equal(result.outcomes.project_application.ok, true);
  assert.deepEqual(result.outcomes.project_application.details, { accepted_topic_ids: ['topic-1'] });
});

test('project-application failure does not overwrite a completed knowledge suggestion', async () => {
  const result = await executeParallelTracks({}, {
    knowledge: async () => ({ status: 'needs_review', reason: '已建立主題匹配建議，等待接受。' }),
    project_application: async () => { throw new Error('accepted topic lookup unavailable'); }
  }, '2026-09-15T00:00:00.000Z');

  assert.equal(result.context.parallel_tracks.knowledge.status, 'needs_review');
  assert.equal(result.context.parallel_tracks.project_application.status, 'failed');
  assert.equal(result.outcomes.knowledge.ok, true);
  assert.equal(result.outcomes.project_application.ok, false);
});

test('a malformed task result fails only its own track', async () => {
  const result = await executeParallelTracks({}, {
    knowledge: async () => ({ status: 'completed' }),
    project_application: async () => ({ status: 'not_applicable', reason: '尚未有已接受主題。' })
  });

  assert.equal(result.context.parallel_tracks.knowledge.status, 'failed');
  assert.equal(result.context.parallel_tracks.project_application.status, 'not_applicable');
});
