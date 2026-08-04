import { createHash } from 'node:crypto';

import { createFastTrackDraft } from './contentStudioService.js';

const ROUTE_CONFIG = {
  quick_rewrite: {
    format: 'x_thread',
    instruction: 'Write a concise, platform-native Traditional Chinese X thread. Keep attribution and separate verified facts from opinion.'
  },
  content_synthesis: {
    format: 'linkedin_post',
    instruction: 'Write a Traditional Chinese draft that synthesizes the source with the supplied research or validation notes. Attribute the source, distinguish evidence from our conclusions, and do not claim work that the notes do not support.'
  },
  translate_localize: {
    format: 'linkedin_post',
    instruction: 'Adapt the source for a Traditional Chinese professional developer audience. Preserve technical meaning and source attribution; do not invent claims.'
  }
};

function requireString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function extractPocRunId(routeState) {
  const actions = Array.isArray(routeState?.actions) ? routeState.actions : routeState?.routes;
  const pocRoute = actions?.find(route => (
    (route.type === 'apply_poc' || route.type === 'poc_execute')
    && route.status === 'completed'
  ));
  const runId = pocRoute?.outcome?.run_id || pocRoute?.outcome?.reused_run_id;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId || '')
    ? runId
    : null;
}

export function getContentRouteConfig(routeType) {
  const config = ROUTE_CONFIG[routeType];
  if (!config) throw new Error(`Unsupported content route: ${routeType}`);
  return config;
}

export function buildContentRouteIdempotencyKey(postData, routeType) {
  const sourceId = requireString(postData?.id, 'postData.id');
  const digest = createHash('sha256')
    .update(`content-route:v1:${sourceId}:${routeType}`)
    .digest('hex')
    .slice(0, 32);
  return `content-route:v1:${routeType}:${digest}`;
}

export async function createAndStoreContentRoute(input, options = {}) {
  const { postData, routeType, routeState = null, workflowContext = null } = input || {};
  const supabaseClient = options.supabaseClient;
  const draftGenerator = options.draftGenerator || createFastTrackDraft;
  if (!supabaseClient) throw new Error('Supabase client is required');
  if (!postData?.id || !postData?.user_id) {
    throw new Error('postData.id and postData.user_id are required');
  }

  const config = getContentRouteConfig(routeType);
  const draft = await draftGenerator(postData, config.format, {
    routeType,
    instruction: config.instruction,
    workflowContext
  });
  if (!draft?.body) throw new Error('Content draft generator returned an empty body');

  const sourceUrl = postData.original_url || postData.url || null;
  const pocRunId = extractPocRunId(routeState);
  const metadata = {
    route_type: routeType,
    source_url: sourceUrl,
    attribution: draft.metadata?.attribution || sourceUrl,
    key_takeaways: Array.isArray(draft.metadata?.key_takeaways) ? draft.metadata.key_takeaways.slice(0, 10) : [],
    generator: 'content_studio_v1',
    poc_run_id: pocRunId,
    content_basis: routeType === 'quick_rewrite' ? 'source_only' : 'researched'
  };
  const idempotencyKey = buildContentRouteIdempotencyKey(postData, routeType);
  const { data, error } = await supabaseClient.rpc('store_content_draft', {
    p_user_id: postData.user_id,
    p_source_id: postData.id,
    p_format: config.format,
    p_title: requireString(draft.title || postData.title || 'Content draft', 'draft.title'),
    p_body: requireString(draft.body, 'draft.body'),
    p_metadata: metadata,
    p_idempotency_key: idempotencyKey,
    p_poc_run_id: pocRunId
  });

  if (error) throw new Error(`Failed to store content route draft: ${error.message}`);
  const stored = Array.isArray(data) ? data[0] : data;
  if (!stored?.content_asset_id || !stored?.content_revision_id) {
    throw new Error('Content draft storage returned an incomplete result');
  }

  return {
    route_type: routeType,
    draft,
    content_asset_id: stored.content_asset_id,
    content_revision_id: stored.content_revision_id,
    revision_number: stored.revision_number,
    created: Boolean(stored.created),
    idempotency_key: idempotencyKey
  };
}
