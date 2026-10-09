import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrRetryLocalPostCaseFile } from '../../server/services/localMediaKnowledgeWorkflowService.js';

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

test('passes a legacy history payload to the initial local case-file writer without changing semantic status', async () => {
    let receivedWrite;
    let receivedLoad;
    await createOrRetryLocalPostCaseFile({
        userId: 'user-1', postId: 'post-legacy', vaultRoot: '/vault',
        sourceRevisionId: 'source-legacy',
        historicalImport: {
            title: 'Legacy human title', legacyPath: 'wiki/threads/legacy.md', sha256: 'b'.repeat(64), content: 'Old history'
        },
        loadInputs: async input => {
            receivedLoad = input;
            return { post: { id: 'post-legacy', content: 'Source' }, sourceRevision: { id: 'source-legacy', source_payload: {} } };
        },
        createManifest: async () => ({ id: 'manifest-legacy', version: 1, sync_state: 'pending' }),
        loadCaptureEvent: async () => null,
        appendEvent: async () => ({ id: 'event-legacy', sequence: 1 }),
        loadManifest: async () => ({ id: 'manifest-legacy', version: 2 }),
        writeFile: async input => {
            receivedWrite = input;
            return { relativePath: 'Media Knowledge/Posts/Inbox/legacy.md', checksum: 'b'.repeat(64) };
        },
        recordDelivery: async () => ({ id: 'manifest-legacy', sync_state: 'synchronized' })
    });
    assert.deepEqual(receivedWrite.historicalImport, {
        title: 'Legacy human title', legacyPath: 'wiki/threads/legacy.md', sha256: 'b'.repeat(64), content: 'Old history'
    });
    assert.equal(receivedLoad.sourceRevisionId, 'source-legacy');
});
