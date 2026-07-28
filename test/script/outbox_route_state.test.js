import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInitialRouteState,
  deriveOutboxStatus,
  ensureOutboxRoutePlan,
  persistOutboxRouteTransition,
  transitionOutboxRoute
} from '../../server/services/outboxRouteStateService.js';

const NOW = new Date('2026-07-29T00:00:00.000Z');

function createEvent() {
  return {
    id: 'event-1',
    user_id: 'user-1',
    status: 'pending',
    updated_at: '2026-07-28T00:00:00.000Z',
    payload: { event_type: 'source.ingested.v1' }
  };
}

function createUpdateClient(response) {
  const calls = { eq: [] };
  const query = {
    update(payload) {
      calls.payload = payload;
      return this;
    },
    eq(field, value) {
      calls.eq.push([field, value]);
      return this;
    },
    select() { return this; },
    single() { return Promise.resolve({ data: response, error: null }); }
  };
  return {
    calls,
    client: { from: table => {
      assert.equal(table, 'collection_capture_outbox');
      return query;
    } }
  };
}

test('route plan captures each route once and starts pending', () => {
  const state = buildInitialRouteState([
    { type: 'apply_poc', priority: 90, reason: 'Tool source' },
    { type: 'quick_rewrite', priority: 60, reason: 'Content draft' },
    { type: 'apply_poc', priority: 80, reason: 'Duplicate' }
  ], NOW);

  assert.equal(state.schema_version, 1);
  assert.equal(state.routes.length, 2);
  assert.equal(state.routes[0].status, 'pending');
  assert.equal(state.routes[0].status_updated_at, NOW.toISOString());
});

test('a completed POC keeps the outbox pending until every planned route is terminal', () => {
  const event = createEvent();
  event.payload.agent_routes = buildInitialRouteState([
    { type: 'apply_poc', priority: 90, reason: 'Tool source' },
    { type: 'quick_rewrite', priority: 60, reason: 'Content draft' }
  ], NOW);

  const pocDone = transitionOutboxRoute(event, 'apply_poc', 'completed', { run_id: 'run-1' }, NOW);
  assert.equal(pocDone.status, 'pending');
  assert.equal(pocDone.payload.agent_routes.routes[0].status, 'completed');

  const allDone = transitionOutboxRoute(pocDone, 'quick_rewrite', 'completed', { draft_id: 'draft-1' }, NOW);
  assert.equal(allDone.status, 'sent');
  assert.equal(deriveOutboxStatus(allDone.payload.agent_routes, 'pending'), 'sent');
});

test('terminal route states reject unsafe reopening except explicit retry of failed or skipped work', () => {
  const event = createEvent();
  event.payload.agent_routes = buildInitialRouteState([
    { type: 'apply_poc', priority: 90, reason: 'Tool source' }
  ], NOW);

  const done = transitionOutboxRoute(event, 'apply_poc', 'completed', null, NOW);
  assert.throws(
    () => transitionOutboxRoute(done, 'apply_poc', 'pending', null, NOW),
    /Invalid route state transition/
  );
});

test('route-plan persistence and route transition use updated_at as an optimistic lock', async () => {
  const event = createEvent();
  const plannedEvent = {
    ...event,
    payload: {
      ...event.payload,
      agent_routes: buildInitialRouteState([{ type: 'apply_poc', priority: 90, reason: 'Tool source' }], NOW)
    },
    updated_at: '2026-07-29T00:00:01.000Z'
  };
  const planMock = createUpdateClient(plannedEvent);
  const persistedPlan = await ensureOutboxRoutePlan(event, [{ type: 'apply_poc', priority: 90, reason: 'Tool source' }], planMock.client, NOW);

  assert.equal(persistedPlan.updated_at, plannedEvent.updated_at);
  assert.deepEqual(planMock.calls.eq, [
    ['id', event.id],
    ['user_id', event.user_id],
    ['updated_at', event.updated_at]
  ]);

  const transitionedEvent = {
    ...plannedEvent,
    payload: transitionOutboxRoute(plannedEvent, 'apply_poc', 'completed', { run_id: 'run-1' }, NOW).payload,
    status: 'sent',
    updated_at: '2026-07-29T00:00:02.000Z'
  };
  const transitionMock = createUpdateClient(transitionedEvent);
  const persistedTransition = await persistOutboxRouteTransition(
    plannedEvent,
    'apply_poc',
    'completed',
    { run_id: 'run-1' },
    transitionMock.client,
    NOW
  );

  assert.equal(persistedTransition.status, 'sent');
  assert.deepEqual(transitionMock.calls.eq, [
    ['id', plannedEvent.id],
    ['user_id', plannedEvent.user_id],
    ['updated_at', plannedEvent.updated_at]
  ]);
});
