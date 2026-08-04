import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

import { supabase } from '../../server/supabaseClient.js';
import { createAndStoreContentRoute, getContentRouteConfig } from '../../server/services/contentRouteService.js';
import { persistOutboxRouteTransition } from '../../server/services/outboxRouteStateService.js';

export async function processContentRoutes(outboxId) {
  if (!outboxId) {
    throw new Error('Usage: node process-content-routes.js <outbox_id>');
  }

  const { data: event, error } = await supabase
    .from('collection_capture_outbox')
    .select(`
      id, user_id, status, payload, updated_at, locked_at, locked_by, last_error,
      collection_posts (
        *,
        collection_post_analysis (*)
      )
    `)
    .eq('id', outboxId)
    .single();
  if (error || !event) throw new Error(`Failed to fetch outbox item: ${error?.message || 'Item not found'}`);

  const postData = Array.isArray(event.collection_posts) ? event.collection_posts[0] : event.collection_posts;
  if (!postData) throw new Error('Related post data not found for this outbox event');
  const routeState = event.payload?.agent_routes;
  if (routeState?.schema_version !== 1 || !Array.isArray(routeState.routes)) {
    throw new Error('Outbox has no legacy route plan. New workflows use agent:decide and agent:create-draft.');
  }

  let activeEvent = event;
  const pendingRoutes = routeState.routes
    .filter(route => route.status === 'pending')
    .filter(route => {
      try {
        getContentRouteConfig(route.type);
        return true;
      } catch {
        return false;
      }
    });

  if (pendingRoutes.length === 0) {
    console.log('[Content Routes] No pending content routes to process.');
    return activeEvent;
  }

  for (const route of pendingRoutes) {
    activeEvent = await persistOutboxRouteTransition(
      activeEvent,
      route.type,
      'in_progress',
      { started_at: new Date().toISOString() },
      supabase
    );

    try {
      const storedDraft = await createAndStoreContentRoute({
        postData,
        routeType: route.type,
        routeState: activeEvent.payload.agent_routes
      }, {
        supabaseClient: supabase
      });

      activeEvent = await persistOutboxRouteTransition(
        activeEvent,
        route.type,
        'completed',
        {
          completed_at: new Date().toISOString(),
          content_asset_id: storedDraft.content_asset_id,
          content_revision_id: storedDraft.content_revision_id,
          revision_number: storedDraft.revision_number,
          created: storedDraft.created,
          idempotency_key: storedDraft.idempotency_key
        },
        supabase
      );
      console.log(`[Content Routes] ${route.type} stored as asset ${storedDraft.content_asset_id}.`);
    } catch (routeError) {
      activeEvent = await persistOutboxRouteTransition(
        activeEvent,
        route.type,
        'failed',
        { failed_at: new Date().toISOString(), error: routeError.message },
        supabase
      );
      throw routeError;
    }
  }

  console.log(`[Content Routes] Completed. Outbox status: ${activeEvent.status}.`);
  return activeEvent;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  processContentRoutes(process.argv[2]).catch(error => {
    console.error(`[Content Routes] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}
