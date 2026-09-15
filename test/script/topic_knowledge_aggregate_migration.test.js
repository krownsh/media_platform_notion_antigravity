import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../../database/deployments/stage_t_topic_knowledge_aggregates.sql', import.meta.url);

test('Stage T adds controlled topic aggregation fields without mutating human-authored topic fields', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  for (const column of [
    'knowledge_summary',
    'knowledge_concepts',
    'knowledge_open_questions',
    'knowledge_source_ids',
    'knowledge_source_count',
    'knowledge_revision',
    'knowledge_aggregated_at'
  ]) {
    assert.match(sql, new RegExp(`add column if not exists ${column}`, 'i'));
  }

  assert.match(sql, /jsonb_typeof\(knowledge_concepts\) = 'array'/);
  assert.match(sql, /jsonb_typeof\(knowledge_open_questions\) = 'array'/);
  assert.match(sql, /knowledge_source_count >= 0/);
  assert.match(sql, /knowledge_revision >= 0/);
  assert.doesNotMatch(sql, /update\s+public\.collection_topics/i);
  assert.doesNotMatch(sql, /alter column\s+(purpose|description|keywords|desired_outcomes)/i);
});
