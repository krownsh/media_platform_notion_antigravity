import assert from 'node:assert/strict';
import test from 'node:test';

import { persistFolderDecision, persistTopicDecision } from '../../server/services/autonomousKnowledgeService.js';

test('suggested topic never creates a topic row', async () => {
    let inserts = 0;
    const supabase = { from(table) {
        assert.equal(table, 'collection_topics');
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: null }), insert() { inserts += 1; throw new Error('must not create topic'); } };
    }};
    const result = await persistTopicDecision({ collection_posts: { id: 'post-1', user_id: 'user-1' } }, { suggested_title: 'Agent tools', confidence: 0.99 }, null, supabase);
    assert.equal(result.reason, 'no_existing_topic');
    assert.equal(inserts, 0);
});

test('topic ID links a tenant-owned existing topic without creating one', async () => {
    let match = null;
    const supabase = { from(table) {
        if (table === 'collection_topics') return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: 'topic-1', user_id: 'user-1', origin: 'user', status: 'active' }, error: null }) };
        if (table === 'collection_topic_source_matches') return { upsert(value) { match = value; return { select() { return { single: async () => ({ data: { id: 'match-1' }, error: null }) }; } }; } };
        throw new Error(`Unexpected table ${table}`);
    }};
    await persistTopicDecision({ collection_posts: { id: 'post-1', user_id: 'user-1' } }, { topic_id: 'topic-1', confidence: 0.99 }, { kind: 'related', confidence: 0.9 }, supabase);
    assert.equal(match.topic_id, 'topic-1');
    assert.equal(match.status, 'suggested');
});

test('legacy agent_auto topic IDs cannot receive a new source match', async () => {
    let matchWrites = 0;
    const supabase = { from(table) {
        if (table === 'collection_topics') return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: 'legacy-topic', user_id: 'user-1', origin: 'agent_auto', status: 'active' }, error: null }) };
        if (table === 'collection_topic_source_matches') return { upsert() { matchWrites += 1; throw new Error('must not match an unaccepted legacy topic'); } };
        throw new Error(`Unexpected table ${table}`);
    }};
    const result = await persistTopicDecision(
        { collection_posts: { id: 'post-1', user_id: 'user-1' } },
        { topic_id: 'legacy-topic', suggested_title: 'Agent tools', confidence: 0.99 },
        { kind: 'related', confidence: 0.9 },
        supabase
    );
    assert.equal(result.reason, 'topic_not_user_active');
    assert.equal(result.proposal.suggested_title, 'Agent tools');
    assert.equal(matchWrites, 0);
});

test('suggested folder never creates or assigns a collection', async () => {
    const supabase = { from() { throw new Error('must not query or create a collection'); } };
    const result = await persistFolderDecision({ collection_posts: { id: 'post-1', user_id: 'user-1' } }, { suggested_name: 'Agent 工具' }, supabase);
    assert.equal(result.assigned, false);
    assert.equal(result.reason, 'no_existing_collection');
});
