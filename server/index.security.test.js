import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 33001 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const API_KEY = 'test-media-api-key';

let child;

async function startServer() {
  if (child) return;
  child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
      FRONTEND_URL: 'http://127.0.0.1',
      MEDIA_API_KEY: API_KEY,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (d) => { output += d.toString(); });
  child.stderr.on('data', (d) => { output += d.toString(); });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server did not start; output=${output}`)), 15000);
    child.on('exit', (code) => reject(new Error(`server exited early code=${code}; output=${output}`)));
    child.stdout.on('data', (d) => {
      if (d.toString().includes('Server running')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}

async function request(path, options = {}) {
  await startServer();
  return fetch(`${BASE}${path}`, options);
}

test.after(() => {
  if (child && !child.killed) child.kill('SIGTERM');
});

test('GET /healthz returns explicit service health JSON', async () => {
  const res = await request('/healthz');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, 'media-collection-api');
});

test('GET /api/posts is not publicly readable without auth', async () => {
  const res = await request('/api/posts');
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, 'Unauthorized');
});

test('GET /api/stats/overview is not publicly readable without auth', async () => {
  const res = await request('/api/stats/overview?userId=test-user');
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, 'Unauthorized');
});

test('unknown /api routes return JSON 404 instead of Express HTML fallback', async () => {
  const res = await request('/api/post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type') || '', /application\/json/);
  const body = await res.json();
  assert.equal(body.error, 'API route not found');
  assert.equal(body.path, '/api/post');
});
