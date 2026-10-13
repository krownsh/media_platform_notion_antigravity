import test from 'node:test';
import assert from 'node:assert/strict';

import { completeCaptureRequest } from '../../server/services/captureRequestService.js';

test('owner-guided capture completion records source facts without an outbox reference', async () => {
    let rpcName;
    let rpcInput;
    const client = {
        rpc(name, input) {
            rpcName = name;
            rpcInput = input;
            return {
                single: async () => ({ data: { id: 'request-1', status: 'finalized' }, error: null })
            };
        }
    };

    const completed = await completeCaptureRequest({
        requestId: 'request-1',
        workerId: 'worker-1',
        status: 'finalized',
        captureQuality: 'complete',
        postId: 'post-1',
        sourceRevisionId: 'revision-1'
    }, client);

    assert.equal(rpcName, 'complete_owner_guided_capture_request');
    assert.deepEqual(rpcInput, {
        p_request_id: 'request-1',
        p_worker_id: 'worker-1',
        p_status: 'finalized',
        p_capture_quality: 'complete',
        p_post_id: 'post-1',
        p_source_revision_id: 'revision-1'
    });
    assert.equal(Object.hasOwn(rpcInput, 'p_outbox_event_id'), false);
    assert.equal(completed.status, 'finalized');
});
