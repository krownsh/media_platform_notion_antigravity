import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(projectRoot, ...parts), 'utf8');

const server = read('server', 'index.js');
const topicsPage = read('src', 'pages', 'TopicsPage.jsx');
const topicAggregateService = read('server', 'services', 'topicKnowledgeAggregateService.js');
const drain = read('scripts', 'agent-sdk', 'drain-vault-sync.js');

test('M5 read-only gate exposes reviewable topic evidence without a live batch-import path', () => {
  assert.match(server, /app\.use\(['"]\/api\/topics['"], requireSupabaseJwt\)/);
  assert.match(server, /app\.post\(['"]\/api\/topics\/matches\/dry-run['"]/);
  assert.match(server, /suggestTopicMatches\(source, topics \|\| \[\]\)/);
  assert.doesNotMatch(server, /app\.post\(['"]\/api\/topics\/[^'"]*(?:batch|import|backfill|apply)/i);

  assert.match(topicsPage, /aria-label="知識彙整"/);
  assert.match(topicsPage, /knowledge_summary/);
  assert.match(topicsPage, /knowledge_source_count/);
  assert.match(topicsPage, /knowledge_revision/);
  assert.match(topicsPage, /knowledge_source_ids/);
  assert.match(topicsPage, /href=\{`\/post\/\$\{sourceId\}`\}/);
});

test('M5 gate keeps aggregate writes scoped, revision-protected, and separate from Vault sync failures', () => {
  assert.match(topicAggregateService, /\.eq\('user_id', userId\)/);
  assert.match(topicAggregateService, /\.eq\('knowledge_revision', topic\.knowledge_revision\)/);
  assert.match(topicAggregateService, /TOPIC_AGGREGATE_CONFLICT/);

  assert.match(drain, /for \(let index = 0; index < maxItems; index \+= 1\)/);
  assert.match(drain, /try \{[\s\S]*?await syncWorkflow\([\s\S]*?\} catch \(error\) \{/);
  assert.match(drain, /failed: results\.filter\(item => item\.status === 'failed'\)/);
  assert.match(drain, /succeeded/);
});
