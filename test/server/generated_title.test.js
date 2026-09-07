import assert from 'node:assert/strict';
import test from 'node:test';

import { persistGeneratedTitle } from '../../server/services/autonomousKnowledgeService.js';
import { buildAiTitleBackfillManifest } from '../../scripts/maintenance/audit-ai-title-backfill.js';

test('generated titles are persisted only when the source supplied no title', async () => {
    let update;
    const query = {
        update(value) { update = value; return this; },
        eq() { return this; },
        is() { return this; },
        select() { return this; },
        maybeSingle: async () => ({ data: { id: 'analysis-1', generated_title: '可回收的 AI 顯示標題' }, error: null })
    };
    const result = await persistGeneratedTitle(
        { id: 'post-1', user_id: 'user-1', title: null },
        ' 可回收的 AI 顯示標題 ',
        { from: () => query },
        'capture_ai'
    );
    assert.equal(result.persisted, true);
    assert.equal(update.generated_title, '可回收的 AI 顯示標題');
    assert.equal(update.title_generation_source, 'capture_ai');

    const skipped = await persistGeneratedTitle(
        { id: 'post-1', user_id: 'user-1', title: '來源原始標題' },
        '不應覆寫',
        { from: () => { throw new Error('must not write'); } }
    );
    assert.equal(skipped.reason, 'source_title_present');
});

test('AI-title dry run reports candidates and token estimates without content or writes', () => {
    const manifest = buildAiTitleBackfillManifest([
        { id: 'post-1', user_id: 'user-1', content: '這是一段需要產生標題的內容', created_at: '2026-09-01T00:00:00Z' },
        { id: 'post-2', user_id: 'user-1', title: '來源標題', content: '不應列入' },
        { id: 'post-3', user_id: 'user-1', collection_post_analysis: [{ generated_title: '已產生' }], content: '不應列入' }
    ], { limit: 10 });
    assert.equal(manifest.writes_performed, false);
    assert.equal(manifest.model_calls_performed, false);
    assert.deepEqual(manifest.candidates.map(item => item.post_id), ['post-1']);
    assert.equal('content' in manifest.candidates[0], false);
    assert.equal(manifest.estimates.posts, 1);
});
