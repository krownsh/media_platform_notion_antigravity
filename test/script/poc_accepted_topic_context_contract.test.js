import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const governance = fs.readFileSync(new URL('../../server/services/topicGovernanceService.js', import.meta.url), 'utf8');
const workbench = fs.readFileSync(new URL('../../server/routes/pocWorkbenchRoutes.js', import.meta.url), 'utf8');

test('POC workbench exposes only active owner-accepted topic context', () => {
  assert.match(governance, /description, purpose, desired_outcomes, keywords/);
  assert.match(governance, /topic\?\.origin === 'user' && topic\?\.status === 'active'/);
  assert.match(workbench, /getAcceptedTopicsForSource\(post, supabase\)/);
  assert.match(workbench, /accepted_topics:/);
  const panel = fs.readFileSync(new URL('../../src/components/PocWorkbenchPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /已接受主題脈絡/);
  assert.match(panel, /state\.accepted_topics\.map/);
});
