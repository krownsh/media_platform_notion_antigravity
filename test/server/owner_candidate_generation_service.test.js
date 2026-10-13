import assert from 'node:assert/strict';
import test from 'node:test';

import { candidateGenerationNextAction, ensureCandidateGenerationJob } from '../../server/services/ownerCandidateGenerationService.js';

test('candidate generation queue only records a pending owner-scoped handoff', async () => {
    let rpcInput;
    const job = await ensureCandidateGenerationJob({
        userId: 'user-1', sourceRevisionId: 'revision-1', reviewPacketId: 'packet-1', captureQuality: 'complete',
        supabaseClient: { rpc(name, input) { assert.equal(name, 'enqueue_owner_candidate_generation_job'); rpcInput = input; return { single: async () => ({ data: { id: 'job-1', status: 'pending' }, error: null }) }; } }
    });
    assert.equal(job.status, 'pending');
    assert.deepEqual(rpcInput, { p_user_id: 'user-1', p_source_revision_id: 'revision-1', p_review_packet_id: 'packet-1', p_initial_status: 'pending' });
});

test('candidate generation still requires an Owner discussion before a decision', () => {
    const packet = { id: 'packet-1', source_revision: { capture_quality: 'complete' }, checkpoints: [] };
    assert.deepEqual(candidateGenerationNextAction({ packet, job: { status: 'pending' } }).kind, 'candidate_generation_pending');
    assert.deepEqual(candidateGenerationNextAction({ packet, job: { status: 'completed' } }).kind, 'discuss_source_with_agent');
    assert.deepEqual(candidateGenerationNextAction({ packet: { ...packet, source_revision: { capture_quality: 'partial' } } }).kind, 'repair_source');
});
