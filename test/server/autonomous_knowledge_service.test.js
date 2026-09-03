import assert from 'node:assert/strict';
import test from 'node:test';

import { persistTopicDecision } from '../../server/services/autonomousKnowledgeService.js';

function query(result) {
    return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => result,
        single: async () => result
    };
}

test('persistTopicDecision reuses a topic when a concurrent insert hits the user-slug unique constraint', async () => {
    const existingTopic = {
        id: 'topic-existing', user_id: 'user-1', slug: 'agent-tools',
        title: 'Agent tools', status: 'active', origin: 'agent_auto'
    };
    let topicLookups = 0;
    let matchUpsert = null;
    const supabase = {
        from(table) {
            if (table === 'collection_topics') {
                return {
                    select() { return this; },
                    eq() { return this; },
                    maybeSingle: async () => {
                        topicLookups += 1;
                        return { data: topicLookups === 1 ? null : existingTopic, error: null };
                    },
                    insert() {
                        return {
                            select() {
                                return {
                                    single: async () => ({
                                        data: null,
                                        error: { code: '23505', message: 'duplicate key value violates unique constraint "collection_topics_user_slug_unique"' }
                                    })
                                };
                            }
                        };
                    }
                };
            }
            if (table === 'collection_topic_source_matches') {
                return {
                    upsert(value) {
                        matchUpsert = value;
                        return {
                            select() {
                                return {
                                    single: async () => ({
                                        data: { id: 'match-1', topic_id: 'topic-existing', source_id: 'post-1', match_type: 'related', score: 91, status: 'accepted' },
                                        error: null
                                    })
                                };
                            }
                        };
                    }
                };
            }
            throw new Error(`Unexpected table: ${table}`);
        }
    };

    const result = await persistTopicDecision(
        { collection_posts: { id: 'post-1', user_id: 'user-1' } },
        { title: 'Agent tools', slug: 'agent-tools', confidence: 0.91, keywords: ['agent'] },
        { kind: 'related', confidence: 0.91, rationale: 'same domain' },
        supabase
    );

    assert.equal(topicLookups, 2);
    assert.equal(result.topic.id, 'topic-existing');
    assert.equal(matchUpsert.topic_id, 'topic-existing');
});
