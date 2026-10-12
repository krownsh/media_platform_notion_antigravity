import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createOrRetryLocalPostCaseFile,
    rehomeLocalPostCaseFileToInbox
} from '../../server/services/localMediaKnowledgeWorkflowService.js';

test('creates one owner-scoped Inbox case file and marks it synchronized only after the writer succeeds', async () => {
    const calls = [];
    const result = await createOrRetryLocalPostCaseFile({
        userId: 'user-1', postId: 'post-1', vaultRoot: '/vault',
        loadInputs: async () => ({ post: { id: 'post-1', content: 'Source' }, sourceRevision: { id: 'source-1', source_payload: { media: [] } } }),
        createManifest: async () => ({ id: 'manifest-1', version: 1, sync_state: 'pending', relative_path: null }),
        loadCaptureEvent: async () => null,
        appendEvent: async input => { calls.push(['event', input]); return { id: 'event-1', sequence: 1 }; },
        loadManifest: async () => ({ id: 'manifest-1', version: 2 }),
        writeFile: async input => { calls.push(['write', input]); return { relativePath: 'Media Knowledge/Posts/Inbox/post.md', checksum: 'a'.repeat(64) }; },
        recordDelivery: async input => { calls.push(['delivery', input]); return { id: 'manifest-1', sync_state: 'synchronized' }; }
    });
    assert.equal(result.manifest.sync_state, 'synchronized');
    assert.deepEqual(calls.map(([kind]) => kind), ['event', 'write', 'delivery']);
    assert.equal(calls[2][1].lastWrittenEventSequence, 1);
});

test('rehomes one existing file to Inbox, records the move, and then updates its manifest', async () => {
    const calls = [];
    let loadCount = 0;
    const result = await rehomeLocalPostCaseFileToInbox({
        userId: 'user-1', postId: 'post-1', vaultRoot: '/vault',
        loadInputs: async () => ({
            post: { id: 'post-1', title: 'Source' },
            sourceRevision: { id: 'source-1', source_payload: { post: { content: 'Source' } } }
        }),
        loadManifest: async () => {
            loadCount += 1;
            return {
                id: 'manifest-1', version: loadCount === 1 ? 3 : 4,
                relative_path: 'Media Knowledge/Posts/Accepted/source.md', sync_state: 'synchronized'
            };
        },
        moveFile: async input => {
            calls.push(['move', input]);
            return { moved: true, recovered: false, relativePath: 'Media Knowledge/Posts/Inbox/source.md', checksum: 'a'.repeat(64) };
        },
        appendEvent: async input => {
            calls.push(['event', input]);
            return { id: 'event-2', sequence: 2, occurred_at: '2026-10-12T00:00:00.000Z' };
        },
        appendFileEvent: async input => {
            calls.push(['file-event', input]);
            return { relativePath: 'Media Knowledge/Posts/Inbox/source.md', checksum: 'b'.repeat(64) };
        },
        recordDelivery: async input => {
            calls.push(['delivery', input]);
            return { id: 'manifest-1', sync_state: 'synchronized' };
        }
    });
    assert.equal(result.outcome, 'rehomed_and_synchronized');
    assert.deepEqual(calls.map(([kind]) => kind), ['move', 'event', 'file-event', 'delivery']);
    assert.equal(calls[3][1].expectedVersion, 4);
    assert.equal(calls[3][1].lastWrittenEventSequence, 2);
    assert.equal(calls[1][1].eventType, 'rename_move');
});
