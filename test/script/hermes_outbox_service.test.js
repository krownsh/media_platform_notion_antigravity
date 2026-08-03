import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHermesGateResult } from '../../scripts/agent-sdk/get-inbox.js';
import {
  claimHermesOutboxItem,
  completeHermesImageReview,
  completeHermesStoredOnlyReview,
  failHermesOutboxItem,
  formatHermesFailure,
  isOutboxLeaseAvailable,
  normalizeHermesIdentity,
  normalizeInboxLimit,
  requireHermesImageLease,
  releaseHermesOutboxItem
} from '../../server/services/hermesOutboxService.js';

const NOW = new Date('2026-07-29T12:00:00.000Z');
const ANALYSIS_ID = '22222222-2222-4222-8222-222222222222';

function createRow(overrides = {}) {
  return {
    id: 'event-1',
    user_id: 'user-1',
    aggregate_id: 'post-1',
    event_type: 'source.ingested.v1',
    correlation_id: 'correlation-1',
    payload: { event_type: 'source.ingested.v1' },
    status: 'pending',
    attempt_count: 0,
    available_at: '2026-07-29T11:00:00.000Z',
    locked_at: null,
    locked_by: null,
    last_error: null,
    created_at: '2026-07-29T11:00:00.000Z',
    updated_at: '2026-07-29T11:00:00.000Z',
    ...overrides
  };
}

function createSupabaseClient(initialRow) {
  let row = structuredClone(initialRow);

  class Query {
    constructor() {
      this.filters = [];
      this.updatePayload = null;
    }

    select() { return this; }
    update(payload) { this.updatePayload = payload; return this; }
    eq(field, value) { this.filters.push(candidate => candidate[field] === value); return this; }
    is(field, value) { this.filters.push(candidate => candidate[field] === value); return this; }

    maybeSingle() {
      const matches = row && this.filters.every(filter => filter(row));
      if (!matches) return Promise.resolve({ data: null, error: null });
      if (this.updatePayload) {
        row = {
          ...row,
          ...structuredClone(this.updatePayload),
          updated_at: new Date(new Date(row.updated_at).getTime() + 1_000).toISOString()
        };
      }
      return Promise.resolve({ data: structuredClone(row), error: null });
    }
  }

  return {
    from(table) {
      assert.equal(table, 'collection_capture_outbox');
      return new Query();
    },
    readRow() { return structuredClone(row); }
  };
}

test('Hermes pre-check stays silent when empty and wakes with bounded ids when pending', () => {
  assert.deepEqual(buildHermesGateResult([]), { wakeAgent: false });
  assert.deepEqual(buildHermesGateResult([
    {
      id: 'a',
      payload: { source_type: 'image_upload' },
      collection_posts: { platform: 'image' }
    },
    { id: 'b' }
  ]), {
    wakeAgent: true,
    context: {
      pending_count: 2,
      outbox_ids: ['a', 'b'],
      items: [
        { outbox_id: 'a', source_type: 'image_upload', platform: 'image' },
        { outbox_id: 'b', source_type: 'url_capture', platform: 'unknown' }
      ]
    }
  });
  assert.equal(normalizeInboxLimit(999), 100);
  assert.equal(normalizeInboxLimit('bad'), 20);
});

test('Hermes identity and failure records are safe and structured', () => {
  assert.equal(normalizeHermesIdentity('hermes:windows/home-1'), 'hermes:windows/home-1');
  assert.throws(() => normalizeHermesIdentity('bad identity with spaces'), /safe characters/);
  const failure = JSON.parse(formatHermesFailure('route.plan', new TypeError('broken'), 'hermes:home', NOW));
  assert.equal(failure.source, 'hermes-agent');
  assert.equal(failure.stage, 'route.plan');
  assert.equal(failure.error_type, 'TypeError');
  assert.equal(failure.failed_at, NOW.toISOString());
});

test('fresh locks block a claim while stale locks can be reclaimed', () => {
  assert.equal(isOutboxLeaseAvailable(createRow(), NOW, 15), true);
  assert.equal(isOutboxLeaseAvailable(createRow({ locked_at: '2026-07-29T11:55:00.000Z' }), NOW, 15), false);
  assert.equal(isOutboxLeaseAvailable(createRow({ locked_at: '2026-07-29T11:30:00.000Z' }), NOW, 15), true);
  assert.equal(isOutboxLeaseAvailable(createRow({ status: 'processing' }), NOW, 15), false);
});

test('claim, release, and failure recording preserve explicit lease ownership', async () => {
  const client = createSupabaseClient(createRow());
  const claimed = await claimHermesOutboxItem('event-1', 'hermes:home', client, { now: NOW });
  assert.equal(claimed.status, 'pending');
  assert.equal(claimed.locked_by, 'hermes:home');
  assert.equal(claimed.attempt_count, 1);

  await assert.rejects(
    () => releaseHermesOutboxItem(claimed, 'hermes:other', client),
    error => error.code === 'OUTBOX_LEASE_OWNER_MISMATCH'
  );

  const released = await releaseHermesOutboxItem(claimed, 'hermes:home', client, {
    availableAt: NOW,
    keepStatus: true
  });
  assert.equal(released.status, 'pending');
  assert.equal(released.locked_by, null);

  const retryClient = createSupabaseClient(createRow());
  const retryClaim = await claimHermesOutboxItem('event-1', 'hermes:home', retryClient, { now: NOW });
  const failed = await failHermesOutboxItem(
    retryClaim,
    'hermes:home',
    'route_plan',
    new Error('model response invalid'),
    retryClient,
    { now: NOW }
  );
  assert.equal(failed.status, 'failed');
  assert.equal(failed.locked_by, null);
  assert.match(failed.last_error, /model response invalid/);
});

test('collect-only review becomes sent without creating an execution route', async () => {
  const client = createSupabaseClient(createRow());
  const claimed = await claimHermesOutboxItem('event-1', 'hermes:home', client, { now: NOW });
  const reviewed = await completeHermesStoredOnlyReview(
    claimed,
    'hermes:home',
    client,
    { now: NOW, reason: 'collect mode' }
  );

  assert.equal(reviewed.status, 'sent');
  assert.equal(reviewed.locked_by, null);
  assert.equal(reviewed.payload.hermes_review.status, 'stored_only');
  assert.equal(reviewed.payload.hermes_review.reason, 'collect mode');
  assert.equal(reviewed.payload.agent_routes, undefined);
});

test('image analysis requires an owned lease and completes the outbox as sent', async () => {
  const imageRow = createRow({
    payload: { event_type: 'source.ingested.v1', source_type: 'image_upload' },
    collection_posts: { platform: 'image' }
  });
  const client = createSupabaseClient(imageRow);

  await assert.rejects(
    () => requireHermesImageLease('event-1', 'hermes:home', client),
    error => error.code === 'OUTBOX_LEASE_OWNER_MISMATCH'
  );

  await claimHermesOutboxItem('event-1', 'hermes:home', client, { now: NOW });
  const leased = await requireHermesImageLease('event-1', 'hermes:home', client);
  const completed = await completeHermesImageReview(
    leased,
    'hermes:home',
    ANALYSIS_ID,
    client,
    { now: NOW }
  );

  assert.equal(completed.status, 'sent');
  assert.equal(completed.locked_by, null);
  assert.equal(completed.payload.hermes_review.status, 'analyzed');
  assert.equal(completed.payload.hermes_review.analysis_id, ANALYSIS_ID);
  assert.equal(completed.payload.hermes_review.reviewed_by, 'hermes:home');
});

test('image completion rejects URL outbox items', async () => {
  const client = createSupabaseClient(createRow());
  await claimHermesOutboxItem('event-1', 'hermes:home', client, { now: NOW });

  await assert.rejects(
    () => requireHermesImageLease('event-1', 'hermes:home', client),
    error => error.code === 'OUTBOX_SOURCE_TYPE_MISMATCH'
  );
});
