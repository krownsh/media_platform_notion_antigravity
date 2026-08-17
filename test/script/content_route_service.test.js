import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildContentRouteIdempotencyKey,
  createAndStoreContentRoute,
  getContentRouteConfig,
  storePreparedContentDraft
} from '../../server/services/contentRouteService.js';
import { buildInitialRouteState, transitionOutboxRoute } from '../../server/services/outboxRouteStateService.js';

const postData = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  title: 'Open code review',
  content: 'A deterministic and LLM hybrid code-review workflow.',
  original_url: 'https://github.com/alibaba/open-code-review'
};

test('content route configuration maps each supported route to a safe output format', () => {
  assert.equal(getContentRouteConfig('quick_rewrite').format, 'x_thread');
  assert.equal(getContentRouteConfig('translate_localize').format, 'linkedin_post');
  assert.throws(() => getContentRouteConfig('apply_poc'), /Unsupported content route/);
});

test('content route storage sends stable idempotency and validated POC evidence to the RPC', async () => {
  const event = {
    id: 'event-1',
    user_id: postData.user_id,
    status: 'pending',
    updated_at: '2026-07-29T00:00:00.000Z',
    payload: {
      agent_routes: buildInitialRouteState([
        { type: 'apply_poc', priority: 90, reason: 'Tool source' },
        { type: 'quick_rewrite', priority: 60, reason: 'Content draft' }
      ])
    }
  };
  const routeState = transitionOutboxRoute(
    event,
    'apply_poc',
    'completed',
    { run_id: '33333333-3333-4333-8333-333333333333' }
  ).payload.agent_routes;
  let rpcName = null;
  let rpcArgs = null;
  const supabaseClient = {
    rpc(name, args) {
      rpcName = name;
      rpcArgs = args;
      return Promise.resolve({
        data: [{
          content_asset_id: '44444444-4444-4444-8444-444444444444',
          content_revision_id: '55555555-5555-4555-8555-555555555555',
          revision_number: 1,
          created: true
        }],
        error: null
      });
    }
  };

  const stored = await createAndStoreContentRoute({
    postData,
    routeType: 'quick_rewrite',
    routeState
  }, {
    supabaseClient,
    draftGenerator: async () => ({
      title: 'Code review workflow',
      body: 'Draft body',
      metadata: { attribution: postData.original_url, key_takeaways: ['Deterministic pipeline'] }
    })
  });

  assert.equal(rpcName, 'store_content_draft');
  assert.equal(rpcArgs.p_format, 'x_thread');
  assert.equal(rpcArgs.p_poc_run_id, '33333333-3333-4333-8333-333333333333');
  assert.equal(rpcArgs.p_idempotency_key, buildContentRouteIdempotencyKey(postData, 'quick_rewrite'));
  assert.equal(stored.content_asset_id, '44444444-4444-4444-8444-444444444444');
  assert.equal(stored.created, true);
});

test('Hermes can persist a prepared rewrite without a second model call', async () => {
  let args;
  const result = await storePreparedContentDraft({
    postData,
    routeType: 'quick_rewrite',
    contentOutput: {
      mode: 'fast_rewrite',
      format: 'x_thread',
      title: 'Prepared draft',
      body: 'Source-only draft body',
      confidence: 0.94
    }
  }, {
    supabaseClient: {
      rpc(_name, rpcArgs) {
        args = rpcArgs;
        return Promise.resolve({
          data: [{
            content_asset_id: '66666666-6666-4666-8666-666666666666',
            content_revision_id: '77777777-7777-4777-8777-777777777777',
            revision_number: 1,
            created: true
          }],
          error: null
        });
      }
    }
  });
  assert.equal(args.p_format, 'x_thread');
  assert.equal(args.p_metadata.generator, 'hermes_preprocess_v1');
  assert.equal(args.p_metadata.published, false);
  assert.equal(result.content_asset_id, '66666666-6666-4666-8666-666666666666');
});
