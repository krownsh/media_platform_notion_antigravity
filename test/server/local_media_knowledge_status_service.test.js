import test from 'node:test';
import assert from 'node:assert/strict';
import { describeLocalPostRecord } from '../../server/services/localMediaKnowledgeStatusService.js';

test('local record status always explains the phase, why, and exactly one next action', () => {
    assert.deepEqual(describeLocalPostRecord({ sourceRevision: null, manifest: null }), {
        phase: 'source_unavailable',
        label: '尚未取得可落盤來源',
        reason: '需要先完成貼文來源擷取，才能建立可追溯的本機紀錄。',
        next_action: { type: 'resume_capture', label: '回到擷取流程' }
    });
    assert.deepEqual(describeLocalPostRecord({ sourceRevision: { id: 'source-1' }, manifest: null }), {
        phase: 'ready_to_create',
        label: '待建立本機紀錄',
        reason: '來源已保存；尚未建立本機 case file。',
        next_action: { type: 'create_local_record', label: '建立本機紀錄' }
    });
    assert.deepEqual(describeLocalPostRecord({ sourceRevision: { id: 'source-1' }, manifest: {
        sync_state: 'synchronized', relative_path: 'Media Knowledge/Posts/Inbox/post.md', last_content_sha256: 'a'.repeat(64)
    } }), {
        phase: 'synchronized',
        label: '已落盤',
        reason: '本機 case file 已完成上次確認的寫入。',
        next_action: { type: 'open_local_record', label: '查看本機紀錄' },
        relative_path: 'Media Knowledge/Posts/Inbox/post.md',
        checksum: 'a'.repeat(64)
    });
});

