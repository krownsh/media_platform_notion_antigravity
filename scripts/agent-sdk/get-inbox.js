import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { listHermesInbox, normalizeInboxLimit } from '../../server/services/hermesOutboxService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function readOption(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function postFromEvent(event) {
  return Array.isArray(event.collection_posts) ? event.collection_posts[0] : event.collection_posts;
}

function analysisFromPost(post) {
  return Array.isArray(post?.collection_post_analysis)
    ? post.collection_post_analysis[0]
    : post?.collection_post_analysis;
}

export function buildHermesGateResult(events) {
  if (!Array.isArray(events) || events.length === 0) return { wakeAgent: false };
  return {
    wakeAgent: true,
    context: {
      pending_count: events.length,
      outbox_ids: events.map(event => event.id),
      items: events.map(event => ({
        outbox_id: event.id,
        source_type: event?.payload?.source_type || 'url_capture',
        platform: postFromEvent(event)?.platform || 'unknown'
      }))
    }
  };
}

export async function getInbox(options = {}) {
  const supabaseClient = options.supabaseClient;
  if (!supabaseClient) throw new Error('Supabase client is required');
  return listHermesInbox(supabaseClient, {
    limit: normalizeInboxLimit(options.limit),
    status: options.status || 'pending',
    leaseMinutes: options.leaseMinutes || 15,
    now: options.now || new Date()
  });
}

function printHumanInbox(events, status) {
  if (events.length === 0) {
    console.log(`✅ No ${status} items in the Hermes inbox.`);
    return;
  }

  console.log(`📬 Found ${events.length} ${status} item(s):`);
  console.log('='.repeat(60));
  events.forEach((event, index) => {
    const post = postFromEvent(event);
    const analysis = analysisFromPost(post);
    console.log(`\n[Item ${index + 1}] Outbox ID: ${event.id}`);
    console.log(`Status: ${event.status}`);
    console.log(`Source type: ${event?.payload?.source_type || 'url_capture'}`);
    console.log(`Platform: ${post?.platform || 'unknown'}`);
    console.log(`URL: ${post?.original_url || 'missing'}`);
    console.log(`Author: ${post?.author_name || 'Unknown'}`);
    const media = Array.isArray(post?.collection_post_media) ? post.collection_post_media : [];
    console.log(`Media: ${media.length} item(s)${media.some(item => item.storage_path) ? ' (private Storage source available)' : ''}`);
    console.log(`Summary: ${analysis?.summary || 'No summary available.'}`);
    console.log(`Attempts: ${event.attempt_count || 0}`);
    if (event.locked_by) console.log(`Locked by: ${event.locked_by}`);
    if (event.last_error) console.log(`Last error: ${event.last_error}`);
  });
  console.log('\n' + '='.repeat(60));
  console.log('Next: use agent:media for image_upload; use agent:analyze for URL captures.');
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const gate = args.includes('--gate');
  const status = readOption(args, '--status', 'pending');
  const limit = readOption(args, '--limit', 20);
  const leaseMinutes = readOption(args, '--lease-minutes', 15);
  process.env.SUPABASE_CLIENT_QUIET = json || gate ? '1' : process.env.SUPABASE_CLIENT_QUIET;
  const { supabase } = await import('../../server/supabaseClient.js');
  const events = await getInbox({ supabaseClient: supabase, limit, status, leaseMinutes });

  if (gate) {
    process.stdout.write(`${JSON.stringify(buildHermesGateResult(events))}\n`);
  } else if (json) {
    process.stdout.write(`${JSON.stringify({ ok: true, status, count: events.length, events }, null, 2)}\n`);
  } else {
    printHumanInbox(events, status);
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  main().catch(error => {
    process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
