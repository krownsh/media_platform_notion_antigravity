import test from 'node:test';
import assert from 'node:assert/strict';
import { attachAcceptedTopicSources } from '../../server/services/topicEvidenceService.js';

test('only accepted, same-topic sources become topic evidence', () => {
  const topics = [{ id: 'topic-a', title: 'A' }, { id: 'topic-b', title: 'B' }];
  const result = attachAcceptedTopicSources(topics, [
    { topic_id: 'topic-a', source_id: 'post-1', status: 'accepted', rationale: 'owner accepted', collection_posts: { id: 'post-1', title: 'First source' } },
    { topic_id: 'topic-a', source_id: 'post-2', status: 'rejected', collection_posts: { id: 'post-2', title: 'Rejected source' } },
    { topic_id: 'topic-b', source_id: 'post-3', status: 'accepted', collection_posts: { id: 'post-3', title: 'Second source' } }
  ]);

  assert.deepEqual(result.map(({ id, accepted_source_count, accepted_sources }) => ({ id, accepted_source_count, accepted_sources })), [
    { id: 'topic-a', accepted_source_count: 1, accepted_sources: [{ id: 'post-1', title: 'First source', rationale: 'owner accepted' }] },
    { id: 'topic-b', accepted_source_count: 1, accepted_sources: [{ id: 'post-3', title: 'Second source', rationale: null }] }
  ]);
});
