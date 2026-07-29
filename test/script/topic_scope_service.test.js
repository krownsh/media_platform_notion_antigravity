import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPocTopicScope } from '../../server/services/topicScopeService.js';

test('selectPocTopicScope only permits an active proposal scope for the target project', () => {
  const scope = selectPocTopicScope([
    { mode: 'poc_proposal', is_active: true, project_targets: ['other_project'] },
    { mode: 'research', is_active: true, project_targets: ['media_platform_notion_antigravity'] },
    { id: 'allowed', mode: 'poc_proposal', is_active: true, project_targets: ['media_platform_notion_antigravity'] }
  ], 'media_platform_notion_antigravity');

  assert.equal(scope.id, 'allowed');
});

test('selectPocTopicScope rejects inactive and malformed scopes', () => {
  assert.equal(selectPocTopicScope([{ mode: 'poc_proposal', is_active: false, project_targets: ['project'] }], 'project'), null);
  assert.equal(selectPocTopicScope(null, 'project'), null);
});
