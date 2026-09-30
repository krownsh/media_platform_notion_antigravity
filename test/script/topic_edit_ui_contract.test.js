import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const card = fs.readFileSync(new URL('../../src/components/TopicCard.jsx', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../../src/pages/TopicsPage.jsx', import.meta.url), 'utf8');

test('owner can edit human-written topic context from a Topic card', () => {
  assert.match(card, />編輯</);
  assert.match(card, /onSave/);
  assert.match(card, /目的/);
  assert.match(card, /關鍵字/);
  assert.match(page, /method: 'PATCH'/);
  assert.match(page, /onSave=/);
});
