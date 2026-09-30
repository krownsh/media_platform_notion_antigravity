import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync(new URL('../../src/components/PostTopicMatchPanel.jsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../../src/components/PostDetailView.jsx', import.meta.url), 'utf8');

test('post detail owns the human topic-match decision gate', () => {
  assert.match(panel, /加入主題/);
  assert.match(panel, /\/api\/topics\/matches\/dry-run/);
  assert.match(panel, /\/api\/topics\/\$\{topicId\}\/matches\/\$\{sourceId\}\/decision/);
  assert.match(panel, /接受/);
  assert.match(panel, /略過/);
  assert.match(detail, /<PostTopicMatchPanel sourceId=\{post\.dbId \|\| post\.id\}/);
});
