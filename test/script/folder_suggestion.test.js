import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestFolders } from '../../src/utils/folderSuggestion.js';

const collections = [
  { id: 'engineering', name: '工程師開發優化' },
  { id: 'tools', name: '好用套件' },
  { id: 'agent', name: 'agent工具' }
];

test('suggestFolders prioritizes engineering folder for a code review source', () => {
  const suggestions = suggestFolders({
    content: 'Open source Code Review DevTools for GitHub with XSS and SQL injection tests',
    analysis: { tags: ['CodeReview'], primary_category: 'tool' }
  }, collections);

  assert.equal(suggestions[0].collection.id, 'engineering');
  assert.ok(suggestions[0].reasons.includes('code review'));
});

test('suggestFolders never suggests a folder for an already organized post', () => {
  assert.deepEqual(suggestFolders({ content: 'agent mcp', collectionId: 'agent' }, collections), []);
});
