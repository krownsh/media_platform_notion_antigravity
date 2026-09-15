import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('human topic match decisions rebuild only the controlled aggregate and surface conflicts', async () => {
    const server = await readFile(new URL('../../server/index.js', import.meta.url), 'utf8');

    assert.match(server, /import \{ rebuildTopicKnowledgeAggregate \} from '\.\/services\/topicKnowledgeAggregateService\.js';/);
    assert.match(server, /app\.post\('\/api\/topics\/:topicId\/matches\/:sourceId\/decision'/);
    assert.match(server, /const aggregate = await rebuildTopicKnowledgeAggregate\(\{/);
    assert.match(server, /supabaseClient: supabase/);
    assert.match(server, /TOPIC_AGGREGATE_CONFLICT/);
    assert.match(server, /status\(409\)/);
});
