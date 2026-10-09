import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeCapture } from '../../server/services/captureFinalizationService.js';

function captureClient(finalized) {
    let rpcInput;
    return {
        get rpcInput() { return rpcInput; },
        rpc(name, input) {
            if (name === 'finalize_collection_capture') {
                rpcInput = input;
                return { single: async () => ({ data: finalized, error: null }) };
            }
            if (name === 'ensure_owner_review_packet') {
                this.reviewPacketInput = input;
                return { single: async () => ({ data: { id: 'packet-1' }, error: null }) };
            }
            throw new Error(`Unexpected RPC: ${name}`);
        },
        from() {
            return {
                select() { return this; },
                eq() { return this; },
                maybeSingle: async () => ({ data: null, error: null })
            };
        }
    };
}

test('finalization submits only raw source facts and a partial quality when requested', async () => {
    const client = captureClient({
        post_id: 'post-1',
        source_revision_id: 'revision-1',
        outbox_event_id: null,
        outbox_event_created: false
    });

    const result = await finalizeCapture(
        'user-1',
        'capture-1',
        'fallback',
        {
            platform: 'generic',
            original_url: 'https://example.com/unavailable',
            content: 'https://example.com/unavailable',
            analysis: { summary: 'must never be persisted' }
        },
        {
            supabaseClient: client,
            configured: true,
            captureQuality: 'partial',
            reviewPreparer: async input => { client.reviewPreparation = input; },
            searchIndexer: async input => { client.searchIndexInput = input; }
        }
    );

    assert.equal(result.source_revision_id, 'revision-1');
    assert.deepEqual(client.rpcInput.p_analysis, {});
    assert.equal(client.rpcInput.p_capture_quality, 'partial');
    assert.equal(client.rpcInput.p_post.source_type, 'fallback_link');
    assert.equal(Object.hasOwn(client.rpcInput.p_post, 'summary'), false);
    assert.deepEqual(client.reviewPreparation, {
        userId: 'user-1',
        sourceRevisionId: 'revision-1',
        supabaseClient: client
    });
    assert.deepEqual(client.searchIndexInput, {
        userId: 'user-1', postId: 'post-1', sourceRevisionId: 'revision-1', supabaseClient: client
    });
});

test('a complete capture automatically starts the owner-visible candidate projection', async () => {
    const client = captureClient({
        post_id: 'post-complete',
        source_revision_id: 'revision-complete',
        outbox_event_id: null,
        outbox_event_created: false
    });
    const preparations = [];

    await finalizeCapture(
        'user-complete',
        'capture-complete',
        'crawler',
        { platform: 'generic', original_url: 'https://example.com/complete', content: 'Captured source' },
        {
            supabaseClient: client,
            configured: true,
            reviewPreparer: async input => preparations.push(input),
            searchIndexer: async () => {}
        }
    );

    assert.equal(client.rpcInput.p_capture_quality, 'complete');
    assert.deepEqual(preparations, [{
        userId: 'user-complete',
        sourceRevisionId: 'revision-complete',
        supabaseClient: client
    }]);
});

test('a finalized capture requests local case-file delivery without blocking source persistence', async () => {
    const client = captureClient({ post_id: 'post-local', source_revision_id: 'revision-local' });
    const deliveries = [];
    const result = await finalizeCapture(
        'user-local', 'capture-local', 'crawler',
        { platform: 'threads', original_url: 'https://threads.net/example', content: 'Captured source' },
        {
            supabaseClient: client, configured: true,
            reviewPreparer: async () => {}, searchIndexer: async () => {},
            localNoteWriter: async input => deliveries.push(input)
        }
    );
    assert.equal(result.post_id, 'post-local');
    assert.deepEqual(deliveries, [{ userId: 'user-local', postId: 'post-local' }]);
});

test('finalization rejects an RPC response that lacks a durable source revision', async () => {
    const client = captureClient({ post_id: 'post-1', outbox_event_id: null });

    await assert.rejects(
        finalizeCapture(
            'user-1',
            'capture-2',
            'crawler',
            { platform: 'generic', original_url: 'https://example.com/source' },
            { supabaseClient: client, configured: true }
        ),
        /incomplete result/
    );
});
