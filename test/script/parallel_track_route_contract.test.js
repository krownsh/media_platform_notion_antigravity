import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('parallel track update route is JWT-protected, owner-scoped, and optimistic-locks context writes', async () => {
  const index = await read('server/index.js');
  const route = await read('server/routes/parallelTrackRoutes.js');

  assert.match(index, /app\.use\('\/api\/parallel-tracks', requireSupabaseJwt, parallelTrackRouter\)/);
  assert.match(route, /\.eq\('user_id', userId\)/);
  assert.match(route, /withParallelTrack\(workflow\.context/);
  assert.match(route, /\.eq\('updated_at', workflow\.updated_at\)/);
  assert.match(route, /Workflow changed; refresh and retry/);
});
