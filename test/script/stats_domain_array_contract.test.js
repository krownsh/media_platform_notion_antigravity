import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const statsService = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'statsService.js'), 'utf8');

test('domain leaderboard does not send a JSON empty-array literal to a PostgreSQL text[] column', () => {
  assert.doesNotMatch(
    statsService,
    /\.not\(\s*['"]source_domains['"]\s*,\s*['"]eq['"]\s*,\s*['"]\[\]['"]\s*\)/,
    'PostgREST forwards [] as a malformed PostgreSQL text[] literal'
  );
  assert.match(statsService, /Array\.isArray\(row\.source_domains\)/);
});
