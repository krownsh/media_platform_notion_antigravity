import test from 'node:test';
import assert from 'node:assert/strict';
import {
    appendLocalNoteEvent,
    createPostCaseFileManifest
} from '../../server/services/localMediaKnowledgeService.js';

test('a new post case-file manifest is owner-scoped and starts pending in Inbox', async () => {
    let upserted;
    const client = {
        from(table) {
            assert.equal(table, 'owner_local_note_manifests');
            return {
                upsert(value, options) {
                    upserted = { value, options };
                    return this;
                },
                select() { return this; },
                maybeSingle: async () => ({ data: { id: 'manifest-1', ...upserted.value }, error: null })
            };
        }
    };

    const manifest = await createPostCaseFileManifest({
        userId: 'user-1',
        postId: 'post-1',
        sourceRevisionId: 'revision-1',
        workflowId: 'workflow-1',
        supabaseClient: client
    });

    assert.deepEqual(upserted, {
        options: { onConflict: 'user_id,post_id', ignoreDuplicates: true },
        value: {
        user_id: 'user-1',
        note_kind: 'post_case_file',
        post_id: 'post-1',
        source_revision_id: 'revision-1',
        workflow_id: 'workflow-1',
        title_status: 'provisional',
        primary_folder: 'Inbox',
        relative_path: null,
        sync_state: 'pending',
        last_error: null
        }
    });
    assert.equal(manifest.id, 'manifest-1');
});

test('a duplicate manifest request returns the existing owner-scoped manifest without creating a second note', async () => {
    let selected = false;
    let fromCalls = 0;
    const client = {
        from(table) {
            assert.equal(table, 'owner_local_note_manifests');
            fromCalls += 1;
            const isLookup = fromCalls === 2;
            return {
                upsert() { return this; },
                select() { return this; },
                maybeSingle: async () => isLookup
                    ? { data: { id: 'existing-manifest', user_id: 'user-1', post_id: 'post-1' }, error: null }
                    : { data: null, error: null },
                eq(column, value) {
                    if (column === 'user_id') assert.equal(value, 'user-1');
                    if (column === 'post_id') assert.equal(value, 'post-1');
                    selected = true;
                    return this;
                }
            };
        }
    };

    const manifest = await createPostCaseFileManifest({
        userId: 'user-1', postId: 'post-1', sourceRevisionId: 'revision-1', supabaseClient: client
    });

    assert.equal(selected, true);
    assert.equal(manifest.id, 'existing-manifest');
});

test('a local note event is appended through the owner-scoped atomic event RPC', async () => {
    let rpcName;
    let rpcInput;
    const client = {
        rpc(name, input) {
            rpcName = name;
            rpcInput = input;
            return {
                single: async () => ({ data: { id: 'event-1', sequence: 2, event_type: 'discussion' }, error: null })
            };
        }
    };

    const event = await appendLocalNoteEvent({
        userId: 'user-1',
        manifestId: 'manifest-1',
        eventType: 'discussion',
        eventStatus: 'candidate',
        actorKind: 'agent',
        eventPayload: { schema_version: 1, conclusion: 'Need Owner confirmation.' },
        supabaseClient: client
    });

    assert.equal(rpcName, 'append_owner_local_note_event');
    assert.deepEqual(rpcInput, {
        p_user_id: 'user-1',
        p_manifest_id: 'manifest-1',
        p_event_type: 'discussion',
        p_event_status: 'candidate',
        p_actor_kind: 'agent',
        p_actor_id: null,
        p_event_payload: { schema_version: 1, conclusion: 'Need Owner confirmation.' },
        p_source_revision_id: null,
        p_review_packet_id: null,
        p_proposal_id: null,
        p_occurred_at: null
    });
    assert.equal(event.sequence, 2);
});
