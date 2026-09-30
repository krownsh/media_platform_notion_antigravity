import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const server = fs.readFileSync(new URL('../../server/index.js', import.meta.url), 'utf8');

test('human topic match decisions persist only the owner decision without a retired aggregate schema', () => {
    assert.match(server, /app\.post\('\/api\/topics\/:topicId\/matches\/:sourceId\/decision'/);
    assert.match(server, /decision_source:\s*'user'/);
    assert.doesNotMatch(server, /rebuildTopicKnowledgeAggregate|TOPIC_AGGREGATE_CONFLICT|topicKnowledgeAggregateService/);
});
