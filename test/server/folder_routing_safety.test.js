import assert from 'node:assert/strict';
import test from 'node:test';

import { persistFolderDecision } from '../../server/services/autonomousKnowledgeService.js';

const USER_ID = '50984520-69ad-4e64-b9c1-503f5c1b0e63';
const APPROVED_ID = '76945268-b2e1-4c8e-bece-11a2000af0a6';
const AUTO_ID = '6366b2e1-5ec2-4e4c-a0e5-35c43c85f7fb';

function workflow(collectionId = null) {
    return { collection_posts: { id: 'post-1', user_id: USER_ID, collection_id: collectionId } };
}

function makeSupabase({
    collection = { id: APPROVED_ID, user_id: USER_ID, name: 'Approved' },
    relatedPost = null,
    updateData = { id: 'post-1', collection_id: APPROVED_ID }
} = {}) {
    const calls = [];
    const result = value => ({ maybeSingle: async () => value, single: async () => value });
    const chain = (table, mode = 'select') => ({
        select() { calls.push({ table, mode, method: 'select' }); return this; },
        eq(column, value) { calls.push({ table, mode, method: 'eq', column, value }); return this; },
        is(column, value) { calls.push({ table, mode, method: 'is', column, value }); return this; },
        in(column, value) { calls.push({ table, mode, method: 'in', column, value }); return this; },
        neq(column, value) { calls.push({ table, mode, method: 'neq', column, value }); return this; },
        not(column, operator, value) { calls.push({ table, mode, method: 'not', column, operator, value }); return this; },
        limit(value) { calls.push({ table, mode, method: 'limit', value }); return this; },
        update(value) { calls.push({ table, mode: 'update', method: 'update', value }); return chain(table, 'update'); },
        maybeSingle: async () => ({
            data: table === 'collection_collections'
                ? collection
                : (table === 'collection_posts' && mode === 'select' ? relatedPost : updateData),
            error: null
        }),
        single: async () => ({ data: updateData, error: null })
    });
    return { calls, from(table) { calls.push({ table, method: 'from' }); return chain(table); } };
}

function policy(ids = [APPROVED_ID]) {
    return { approvedCollectionIds: new Set(ids), minimumConfidence: 0.85, folderTopicMappingMode: 'none' };
}

function updateCalls(fake) {
    return fake.calls.filter(call => call.table === 'collection_posts' && call.method === 'update');
}

test('existing manual collection is preserved before any lookup or update', async () => {
    const fake = makeSupabase();
    const result = await persistFolderDecision(workflow(APPROVED_ID), { collection_id: APPROVED_ID, confidence: 1 }, fake, policy());
    assert.equal(result.assigned, false);
    assert.equal(result.reason, 'existing_collection_preserved');
    assert.equal(fake.calls.filter(call => call.method === 'from').length, 0);
});

test('unapproved and exact auto folder IDs never trigger a collection update', async () => {
    for (const id of ['not-approved', AUTO_ID]) {
        const fake = makeSupabase();
        const result = await persistFolderDecision(workflow(), { collection_id: id, confidence: 1 }, fake, policy());
        assert.equal(result.assigned, false);
        assert.equal(result.reason, 'collection_not_approved');
        assert.equal(updateCalls(fake).length, 0);
    }
});

test('low-confidence direct folder proposal remains Inbox', async () => {
    const fake = makeSupabase();
    const result = await persistFolderDecision(workflow(), { collection_id: APPROVED_ID, confidence: 0.84 }, fake, policy());
    assert.equal(result.assigned, false);
    assert.equal(result.reason, 'folder_confidence_low');
    assert.equal(updateCalls(fake).length, 0);
});

test('caller cannot lower the mandatory 0.85 confidence floor', async () => {
    const fake = makeSupabase();
    const result = await persistFolderDecision(
        workflow(),
        { collection_id: APPROVED_ID, confidence: 0.01 },
        fake,
        { ...policy(), minimumConfidence: 0 }
    );
    assert.equal(result.assigned, false);
    assert.equal(result.reason, 'folder_confidence_low');
    assert.equal(updateCalls(fake).length, 0);
});

test('approved same-owner assignment uses null-only conditional update', async () => {
    const fake = makeSupabase();
    const result = await persistFolderDecision(workflow(), { collection_id: APPROVED_ID, confidence: 0.85 }, fake, policy());
    assert.equal(result.assigned, true);
    assert.equal(updateCalls(fake).length, 1);
    assert.deepEqual(fake.calls.filter(call => call.table === 'collection_posts' && ['eq', 'is'].includes(call.method)), [
        { table: 'collection_posts', mode: 'update', method: 'eq', column: 'id', value: 'post-1' },
        { table: 'collection_posts', mode: 'update', method: 'eq', column: 'user_id', value: USER_ID },
        { table: 'collection_posts', mode: 'update', method: 'is', column: 'collection_id', value: null }
    ]);
});

test('approved duplicate inheritance below threshold remains Inbox without lookup or update', async () => {
    const fake = makeSupabase();
    const result = await persistFolderDecision(
        workflow(),
        { confidence: 0.84 },
        fake,
        { ...policy(), duplicate: { id: 'duplicate-1', collection_id: APPROVED_ID } }
    );
    assert.equal(result.assigned, false);
    assert.equal(result.reason, 'folder_confidence_low');
    assert.equal(fake.calls.filter(call => call.method === 'from').length, 0);
});

test('different-owner collection data is rejected without an update', async () => {
    const fake = makeSupabase({ collection: { id: APPROVED_ID, user_id: 'different-owner', name: 'Foreign' } });
    const result = await persistFolderDecision(workflow(), { collection_id: APPROVED_ID, confidence: 1 }, fake, policy());
    assert.equal(result.assigned, false);
    assert.equal(result.reason, 'collection_not_found');
    assert.equal(updateCalls(fake).length, 0);
});

test('conditional assignment conflict never retries or overwrites', async () => {
    const fake = makeSupabase({ updateData: null });
    const result = await persistFolderDecision(workflow(), { collection_id: APPROVED_ID, confidence: 1 }, fake, policy());
    assert.equal(result.assigned, false);
    assert.equal(result.reason, 'collection_assignment_conflict');
    assert.equal(updateCalls(fake).length, 1);
});

test('missing or low-confidence related inheritance remains Inbox without update', async () => {
    for (const folderInput of [undefined, { confidence: 0.84 }]) {
        const fake = makeSupabase({ relatedPost: { id: 'related-1', collection_id: APPROVED_ID } });
        const result = await persistFolderDecision(
            workflow(),
            folderInput,
            fake,
            { ...policy(), relatedMatches: [{ source_id: 'related-1' }] }
        );
        assert.equal(result.assigned, false);
        assert.equal(result.reason, 'folder_confidence_low');
        assert.equal(updateCalls(fake).length, 0);
    }
});

test('unapproved related inheritance remains Inbox without update', async () => {
    const fake = makeSupabase({ relatedPost: { id: 'related-1', collection_id: AUTO_ID } });
    const result = await persistFolderDecision(
        workflow(),
        { confidence: 1 },
        fake,
        { ...policy(), relatedMatches: [{ source_id: 'related-1' }] }
    );
    assert.equal(result.assigned, false);
    assert.equal(result.reason, 'inherited_collection_not_approved');
    assert.equal(updateCalls(fake).length, 0);
});

test('unapproved duplicate inheritance remains Inbox without update', async () => {
    const fake = makeSupabase();
    const result = await persistFolderDecision(
        workflow(),
        { confidence: 1 },
        fake,
        { ...policy(), duplicate: { id: 'duplicate-1', collection_id: AUTO_ID } }
    );
    assert.equal(result.assigned, false);
    assert.equal(result.reason, 'inherited_collection_not_approved');
    assert.equal(updateCalls(fake).length, 0);
});
