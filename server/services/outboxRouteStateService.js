const ROUTE_TYPES = new Set([
  'quick_rewrite',
  'translate_localize',
  'research_content',
  'apply_poc'
]);

const ROUTE_STATUSES = new Set([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped'
]);

const TERMINAL_ROUTE_STATUSES = new Set(['completed', 'failed', 'skipped']);

function requireObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function nowIso(now) {
  return (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
}

function normalizeRoute(route) {
  const type = String(route?.type || '').trim();
  if (!ROUTE_TYPES.has(type)) throw new Error(`Unsupported route type: ${type || 'missing'}`);

  const priority = Number(route?.priority);
  return {
    type,
    priority: Number.isFinite(priority) ? Math.min(Math.max(Math.round(priority), 1), 100) : 50,
    reason: String(route?.reason || '').slice(0, 1_000)
  };
}

export function buildInitialRouteState(routes, now = new Date()) {
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('At least one route is required to build route state');
  }

  const updatedAt = nowIso(now);
  const seen = new Set();
  const normalizedRoutes = routes
    .map(normalizeRoute)
    .filter(route => {
      if (seen.has(route.type)) return false;
      seen.add(route.type);
      return true;
    })
    .map(route => ({
      ...route,
      status: 'pending',
      status_updated_at: updatedAt,
      outcome: null
    }));

  return {
    schema_version: 1,
    planned_at: updatedAt,
    updated_at: updatedAt,
    routes: normalizedRoutes
  };
}

export function deriveOutboxStatus(routeState, currentOutboxStatus = 'pending') {
  const routes = routeState?.routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('Route state must contain at least one route');
  }

  if (!routes.every(route => TERMINAL_ROUTE_STATUSES.has(route.status))) {
    return currentOutboxStatus === 'processing' ? 'processing' : 'pending';
  }

  return routes.some(route => route.status === 'failed') ? 'failed' : 'sent';
}

function assertTransition(currentStatus, nextStatus) {
  if (!ROUTE_STATUSES.has(nextStatus)) throw new Error(`Unsupported route status: ${nextStatus}`);

  const allowedTransitions = {
    pending: new Set(['pending', 'in_progress', 'completed', 'failed', 'skipped']),
    in_progress: new Set(['pending', 'in_progress', 'completed', 'failed', 'skipped']),
    completed: new Set(['completed']),
    failed: new Set(['failed', 'pending']),
    skipped: new Set(['skipped', 'pending'])
  };

  if (!allowedTransitions[currentStatus]?.has(nextStatus)) {
    throw new Error(`Invalid route state transition: ${currentStatus} -> ${nextStatus}`);
  }
}

export function transitionOutboxRoute(event, routeType, nextStatus, outcome = null, now = new Date()) {
  requireObject(event, 'Outbox event');
  const payload = requireObject(event.payload || {}, 'Outbox payload');
  const routeState = requireObject(payload.agent_routes, 'Outbox payload.agent_routes');
  if (routeState.schema_version !== 1 || !Array.isArray(routeState.routes)) {
    throw new Error('Unsupported outbox route-state schema');
  }

  const updatedAt = nowIso(now);
  let found = false;
  const routes = routeState.routes.map(route => {
    if (route.type !== routeType) return route;
    found = true;
    assertTransition(route.status, nextStatus);
    return {
      ...route,
      status: nextStatus,
      status_updated_at: updatedAt,
      outcome: outcome == null ? route.outcome || null : outcome
    };
  });

  if (!found) throw new Error(`Route is not part of the persisted plan: ${routeType}`);

  const nextRouteState = {
    ...routeState,
    updated_at: updatedAt,
    routes
  };
  const status = deriveOutboxStatus(nextRouteState, event.status);
  return {
    ...event,
    status,
    payload: {
      ...payload,
      agent_routes: nextRouteState
    }
  };
}

export async function ensureOutboxRoutePlan(event, routes, supabaseClient, now = new Date()) {
  requireObject(event, 'Outbox event');
  if (!event.id || !event.user_id || !event.updated_at) {
    throw new Error('Outbox event id, user_id and updated_at are required');
  }
  if (!supabaseClient) throw new Error('Supabase client is required');

  const hasPersistedPlan = event.payload?.agent_routes?.schema_version === 1;
  if (hasPersistedPlan && event.status !== 'pending') return event;

  const nextEvent = {
    ...event,
    status: event.status === 'pending' ? 'processing' : event.status,
    payload: {
      ...(event.payload || {}),
      agent_routes: hasPersistedPlan ? event.payload.agent_routes : buildInitialRouteState(routes, now)
    }
  };

  const { data, error } = await supabaseClient
    .from('collection_capture_outbox')
    .update({ status: nextEvent.status, payload: nextEvent.payload })
    .eq('id', event.id)
    .eq('user_id', event.user_id)
    .eq('updated_at', event.updated_at)
    .select('id, user_id, status, payload, updated_at, locked_at, locked_by, last_error')
    .single();

  if (error || !data) {
    throw new Error(`Unable to persist route plan; reload the outbox event before retrying: ${error?.message || 'no row updated'}`);
  }
  return data;
}

export async function persistOutboxRouteTransition(event, routeType, nextStatus, outcome, supabaseClient, now = new Date()) {
  if (!supabaseClient) throw new Error('Supabase client is required');
  if (!event?.id || !event?.user_id || !event?.updated_at) {
    throw new Error('Outbox event id, user_id and updated_at are required');
  }

  const nextEvent = transitionOutboxRoute(event, routeType, nextStatus, outcome, now);
  const update = {
    status: nextEvent.status,
    payload: nextEvent.payload
  };

  if (nextEvent.status === 'sent' || nextEvent.status === 'failed') {
    update.locked_at = null;
    update.locked_by = null;
    update.last_error = nextEvent.status === 'failed'
      ? String(outcome?.error || 'One or more route tasks failed').slice(0, 4_000)
      : null;
  }

  const { data, error } = await supabaseClient
    .from('collection_capture_outbox')
    .update(update)
    .eq('id', event.id)
    .eq('user_id', event.user_id)
    .eq('updated_at', event.updated_at)
    .select('id, user_id, status, payload, updated_at, locked_at, locked_by, last_error')
    .single();

  if (error || !data) {
    throw new Error(`Unable to persist route transition; reload the outbox event before retrying: ${error?.message || 'no row updated'}`);
  }
  return data;
}
