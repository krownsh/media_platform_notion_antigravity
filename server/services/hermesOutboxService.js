const OUTBOX_STATUSES = new Set(['pending', 'processing', 'sent', 'failed']);
const DEFAULT_INBOX_LIMIT = 20;
const MAX_INBOX_LIMIT = 100;
const DEFAULT_LEASE_MINUTES = 15;
const MAX_ERROR_LENGTH = 4_000;

export const HERMES_OUTBOX_SELECT = `
  id,
  user_id,
  aggregate_id,
  event_type,
  correlation_id,
  payload,
  status,
  attempt_count,
  available_at,
  locked_at,
  locked_by,
  last_error,
  created_at,
  updated_at,
  collection_posts (
    id,
    user_id,
    collection_id,
    platform,
    original_url,
    author_name,
    content,
    full_json,
    source_domains,
    collection_post_analysis (
      summary,
      tags,
      topics,
      primary_category,
      insights
    )
  )
`;

function outboxError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function toDate(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`);
  return date;
}

function normalizeLeaseMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LEASE_MINUTES;
  return Math.min(Math.max(Math.round(parsed), 1), 24 * 60);
}

function normalizeStage(value) {
  const stage = String(value || 'unknown').trim().toLowerCase();
  return /^[a-z0-9._-]{1,80}$/.test(stage) ? stage : 'unknown';
}

export function normalizeInboxLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_INBOX_LIMIT;
  return Math.min(Math.max(Math.round(parsed), 1), MAX_INBOX_LIMIT);
}

export function normalizeHermesIdentity(value) {
  const identity = String(value || '').trim();
  if (!/^[a-zA-Z0-9._:@/-]{1,128}$/.test(identity)) {
    throw new Error('Hermes agent identity must be 1-128 safe characters');
  }
  return identity;
}

export function formatHermesFailure(stage, error, agentIdentity, now = new Date()) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown Hermes processing failure');
  return JSON.stringify({
    source: 'hermes-agent',
    stage: normalizeStage(stage),
    agent: normalizeHermesIdentity(agentIdentity),
    failed_at: toDate(now, 'now').toISOString(),
    error_type: error instanceof Error ? error.name : 'Error',
    message: message.slice(0, 3_000)
  }).slice(0, MAX_ERROR_LENGTH);
}

export function isOutboxLeaseAvailable(event, now = new Date(), leaseMinutes = DEFAULT_LEASE_MINUTES) {
  if (!event || event.status !== 'pending') return false;
  const currentTime = toDate(now, 'now').getTime();
  if (event.available_at && toDate(event.available_at, 'available_at').getTime() > currentTime) return false;
  if (!event.locked_at) return true;
  const leaseMs = normalizeLeaseMinutes(leaseMinutes) * 60_000;
  return toDate(event.locked_at, 'locked_at').getTime() <= currentTime - leaseMs;
}

export async function listHermesInbox(supabaseClient, options = {}) {
  if (!supabaseClient) throw new Error('Supabase client is required');
  const status = String(options.status || 'pending').trim();
  if (status !== 'all' && !OUTBOX_STATUSES.has(status)) {
    throw new Error(`Unsupported outbox status: ${status}`);
  }

  const now = toDate(options.now || new Date(), 'now');
  const staleBefore = new Date(
    now.getTime() - normalizeLeaseMinutes(options.leaseMinutes) * 60_000
  ).toISOString();
  let query = supabaseClient
    .from('collection_capture_outbox')
    .select(HERMES_OUTBOX_SELECT);

  if (status !== 'all') query = query.eq('status', status);
  if (status === 'pending') {
    query = query
      .lte('available_at', now.toISOString())
      .or(`locked_at.is.null,locked_at.lt.${staleBefore}`);
  }

  const { data, error } = await query
    .order('available_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(normalizeInboxLimit(options.limit));

  if (error) throw new Error(`Failed to read Hermes inbox: ${error.message}`);
  return data || [];
}

async function loadOutboxEvent(outboxId, supabaseClient) {
  const id = String(outboxId || '').trim();
  if (!id) throw new Error('Outbox id is required');
  const { data, error } = await supabaseClient
    .from('collection_capture_outbox')
    .select(HERMES_OUTBOX_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Failed to read outbox event: ${error.message}`);
  if (!data) throw outboxError('OUTBOX_NOT_FOUND', `Outbox event not found: ${id}`);
  return data;
}

function addLeaseVersionFilter(query, event) {
  let nextQuery = query
    .eq('id', event.id)
    .eq('user_id', event.user_id)
    .eq('updated_at', event.updated_at);
  nextQuery = event.locked_at
    ? nextQuery.eq('locked_at', event.locked_at)
    : nextQuery.is('locked_at', null);
  return nextQuery;
}

export async function claimHermesOutboxItem(outboxId, agentIdentity, supabaseClient, options = {}) {
  if (!supabaseClient) throw new Error('Supabase client is required');
  const identity = normalizeHermesIdentity(agentIdentity);
  const now = toDate(options.now || new Date(), 'now');
  const event = await loadOutboxEvent(outboxId, supabaseClient);

  if (!isOutboxLeaseAvailable(event, now, options.leaseMinutes)) {
    throw outboxError(
      'OUTBOX_NOT_AVAILABLE',
      `Outbox event ${event.id} is unavailable (status=${event.status}, locked_by=${event.locked_by || 'none'})`
    );
  }

  let query = supabaseClient
    .from('collection_capture_outbox')
    .update({
      attempt_count: Number(event.attempt_count || 0) + 1,
      locked_at: now.toISOString(),
      locked_by: identity,
      last_error: null
    })
    .eq('status', 'pending');
  query = addLeaseVersionFilter(query, event);

  const { data, error } = await query
    .select(HERMES_OUTBOX_SELECT)
    .maybeSingle();
  if (error || !data) {
    throw outboxError(
      'OUTBOX_CLAIM_CONFLICT',
      `Unable to claim outbox event ${event.id}; another agent changed it first${error ? `: ${error.message}` : ''}`
    );
  }
  return data;
}

export async function releaseHermesOutboxItem(eventInput, agentIdentity, supabaseClient, options = {}) {
  if (!supabaseClient) throw new Error('Supabase client is required');
  const event = eventInput?.id ? eventInput : await loadOutboxEvent(eventInput, supabaseClient);
  const identity = normalizeHermesIdentity(agentIdentity);
  if (event.locked_by !== identity) {
    throw outboxError('OUTBOX_LEASE_OWNER_MISMATCH', `Outbox event ${event.id} is not leased by ${identity}`);
  }

  const retryAt = toDate(options.availableAt || new Date(), 'availableAt').toISOString();
  const update = {
    status: options.keepStatus ? event.status : 'pending',
    available_at: retryAt,
    locked_at: null,
    locked_by: null
  };
  if (options.clearError !== false) update.last_error = null;

  let query = supabaseClient.from('collection_capture_outbox').update(update);
  query = addLeaseVersionFilter(query, event).eq('locked_by', identity);
  const { data, error } = await query
    .select(HERMES_OUTBOX_SELECT)
    .maybeSingle();
  if (error || !data) {
    throw outboxError(
      'OUTBOX_RELEASE_CONFLICT',
      `Unable to release outbox event ${event.id}${error ? `: ${error.message}` : ''}`
    );
  }
  return data;
}

export async function failHermesOutboxItem(eventInput, agentIdentity, stage, failure, supabaseClient, options = {}) {
  if (!supabaseClient) throw new Error('Supabase client is required');
  const event = eventInput?.id ? eventInput : await loadOutboxEvent(eventInput, supabaseClient);
  const identity = normalizeHermesIdentity(agentIdentity);
  if (event.locked_by !== identity) {
    throw outboxError('OUTBOX_LEASE_OWNER_MISMATCH', `Outbox event ${event.id} is not leased by ${identity}`);
  }

  const now = toDate(options.now || new Date(), 'now');
  let query = supabaseClient
    .from('collection_capture_outbox')
    .update({
      status: 'failed',
      locked_at: null,
      locked_by: null,
      last_error: formatHermesFailure(stage, failure, identity, now)
    });
  query = addLeaseVersionFilter(query, event).eq('locked_by', identity);
  const { data, error } = await query
    .select(HERMES_OUTBOX_SELECT)
    .maybeSingle();
  if (error || !data) {
    throw outboxError(
      'OUTBOX_FAIL_CONFLICT',
      `Unable to record failure for outbox event ${event.id}${error ? `: ${error.message}` : ''}`
    );
  }
  return data;
}

export async function completeHermesStoredOnlyReview(eventInput, agentIdentity, supabaseClient, options = {}) {
  if (!supabaseClient) throw new Error('Supabase client is required');
  const event = eventInput?.id ? eventInput : await loadOutboxEvent(eventInput, supabaseClient);
  const identity = agentIdentity ? normalizeHermesIdentity(agentIdentity) : null;
  if (identity && event.locked_by !== identity) {
    throw outboxError('OUTBOX_LEASE_OWNER_MISMATCH', `Outbox event ${event.id} is not leased by ${identity}`);
  }

  const reviewedAt = toDate(options.now || new Date(), 'now').toISOString();
  const payload = {
    ...(event.payload || {}),
    hermes_review: {
      schema_version: 1,
      status: 'stored_only',
      reviewed_at: reviewedAt,
      reviewed_by: identity || 'interactive-agent',
      reason: String(options.reason || 'No active research or POC scope applies to this source.').slice(0, 1_000)
    }
  };
  let query = supabaseClient
    .from('collection_capture_outbox')
    .update({
      status: 'sent',
      payload,
      locked_at: null,
      locked_by: null,
      last_error: null
    });
  query = addLeaseVersionFilter(query, event);
  if (identity) query = query.eq('locked_by', identity);
  const { data, error } = await query
    .select(HERMES_OUTBOX_SELECT)
    .maybeSingle();
  if (error || !data) {
    throw outboxError(
      'OUTBOX_REVIEW_CONFLICT',
      `Unable to complete stored-only review for outbox event ${event.id}${error ? `: ${error.message}` : ''}`
    );
  }
  return data;
}
