import test from 'node:test';
import assert from 'node:assert/strict';

const API_KEY = 'test-media-api-key';

process.env.NODE_ENV = 'test';

const { requireApiAuth, requireSupabaseJwt } = await import('../../server/index.js');

// server/index.js loads server/.env during module initialization. Reset the
// test-only capture settings afterwards so a developer's local n8n mapping
// cannot change the assertions below.
process.env.MEDIA_API_KEY = API_KEY;
delete process.env.MEDIA_API_KEY_USER_ID;

function createRequest(headers = {}) {
  return {
    body: { url: 'https://example.com/post', userId: 'attacker-controlled-user-id' },
    header(name) {
      return headers[name.toLowerCase()] || null;
    },
  };
}

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function invokeAuth(headers = {}) {
  const req = createRequest(headers);
  const res = createResponse();
  let didCallNext = false;
  await requireApiAuth(req, res, () => { didCallNext = true; });
  return { req, res, didCallNext };
}

async function invokeInteractiveAuth(headers = {}) {
  const req = createRequest(headers);
  const res = createResponse();
  let didCallNext = false;
  await requireSupabaseJwt(req, res, () => { didCallNext = true; });
  return { req, res, didCallNext };
}

test('capture authentication rejects an unauthenticated body userId', async () => {
  const { res, didCallNext } = await invokeAuth();
  assert.equal(didCallNext, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Unauthorized');
});

test('capture authentication requires an API-key-to-user mapping', async () => {
  const { res, didCallNext } = await invokeAuth({ 'x-api-key': API_KEY });
  assert.equal(didCallNext, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'Capture API key is not mapped to a user');
});

test('a mapped capture API key supplies the server-side user identity', async () => {
  const mappedUserId = '11111111-1111-4111-8111-111111111111';
  process.env.MEDIA_API_KEY_USER_ID = mappedUserId;
  const { req, res, didCallNext } = await invokeAuth({ 'x-api-key': API_KEY });
  delete process.env.MEDIA_API_KEY_USER_ID;

  assert.equal(didCallNext, true);
  assert.equal(res.statusCode, null);
  assert.deepEqual(req.auth, { type: 'api_key', userId: mappedUserId });
});

test('a mapped capture API key is rejected by interactive JWT-only routes', async () => {
  process.env.MEDIA_API_KEY_USER_ID = '11111111-1111-4111-8111-111111111111';
  const { res, didCallNext } = await invokeInteractiveAuth({ 'x-api-key': API_KEY });
  delete process.env.MEDIA_API_KEY_USER_ID;

  assert.equal(didCallNext, false);
  assert.equal(res.statusCode, 401);
});
