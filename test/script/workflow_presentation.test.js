import assert from 'node:assert/strict';
import test from 'node:test';

import { actionBadges, matchesWorkflowFilter, workflowBadge, workflowNextStep } from '../../src/utils/workflowPresentation.js';

test('workflow badge always has a textual lifecycle label', () => {
    assert.equal(workflowBadge(null).label, '尚未納入流程');
    assert.equal(workflowBadge({ stage: 'base_analysis', status: 'pending' }).label, '尚未處理');
    assert.equal(workflowBadge({ stage: 'preprocessing', status: 'processing' }).label, 'AI 整理中');
    assert.equal(workflowBadge({ stage: 'strategy', status: 'awaiting_user' }).label, '等你確認');
    assert.equal(workflowBadge({ stage: 'actions', status: 'processing' }).label, '後續行動中');
    assert.equal(workflowBadge({ stage: 'vault_sync', status: 'pending' }).label, '同步 Obsidian');
    assert.equal(workflowBadge({ stage: 'complete', status: 'completed' }).label, '已完成');
    assert.equal(workflowBadge({ stage: 'actions', status: 'failed' }).label, '需要重試');
});


test('workflow filter groups and next steps use human-facing states rather than internal stage names', () => {
    const attention = { stage: 'strategy', status: 'awaiting_user' };
    const processing = { stage: 'preprocessing', status: 'processing' };
    const completed = { stage: 'complete', status: 'completed' };

    assert.equal(matchesWorkflowFilter(attention, 'needs_attention'), true);
    assert.equal(matchesWorkflowFilter(processing, 'in_progress'), true);
    assert.equal(matchesWorkflowFilter(completed, 'completed'), true);
    assert.equal(matchesWorkflowFilter(null, 'not_started'), true);
    assert.equal(workflowNextStep(attention).label, '打開貼文並選擇後續方向');
    assert.equal(workflowNextStep({ stage: 'actions', status: 'failed' }).label, '打開貼文查看錯誤並重試');
});

test('action badges show all supported directions independently of replication', () => {
    const badges = actionBadges({ action_plan: { actions: [
        { type: 'research', status: 'approved' },
        { type: 'poc_proposal', status: 'pending' },
        { type: 'replication_plan', status: 'approved' },
        { type: 'fast_rewrite', status: 'completed' },
        { type: 'vault_note', status: 'approved' }
    ] } });
    assert.deepEqual(badges.map(item => item.label), ['研究｜已確認', 'POC 提案｜待處理', '復刻方案｜已確認', '快速改寫｜已完成']);
});
