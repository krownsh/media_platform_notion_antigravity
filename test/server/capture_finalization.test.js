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
        { supabaseClient: client, configured: true, captureQuality: 'partial' }
    );

    assert.equal(result.source_revision_id, 'revision-1');
    assert.deepEqual(client.rpcInput.p_analysis, {});
    assert.equal(client.rpcInput.p_capture_quality, 'partial');
    assert.equal(client.rpcInput.p_post.source_type, 'fallback_link');
    assert.equal(Object.hasOwn(client.rpcInput.p_post, 'summary'), false);
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
