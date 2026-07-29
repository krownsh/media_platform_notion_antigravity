import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

import {
  claimHermesOutboxItem,
  failHermesOutboxItem,
  releaseHermesOutboxItem
} from '../../server/services/hermesOutboxService.js';

function readOption(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function requireOption(args, name) {
  const value = readOption(args, name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];
  const outboxId = args[1];
  const agentIdentity = requireOption(args, '--agent');
  process.env.SUPABASE_CLIENT_QUIET = '1';
  const { supabase } = await import('../../server/supabaseClient.js');

  let result;
  if (action === 'claim') {
    result = await claimHermesOutboxItem(outboxId, agentIdentity, supabase, {
      leaseMinutes: readOption(args, '--lease-minutes', 15)
    });
  } else if (action === 'release') {
    result = await releaseHermesOutboxItem(outboxId, agentIdentity, supabase, {
      availableAt: readOption(args, '--available-at', new Date().toISOString()),
      keepStatus: args.includes('--keep-status')
    });
  } else if (action === 'fail') {
    const stage = requireOption(args, '--stage');
    const message = requireOption(args, '--error');
    result = await failHermesOutboxItem(outboxId, agentIdentity, stage, new Error(message), supabase);
  } else {
    throw new Error('Usage: outbox-lease.js <claim|release|fail> <outbox-id> --agent <identity> [options]');
  }

  process.stdout.write(`${JSON.stringify({ ok: true, action, event: result }, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
  process.exitCode = 1;
});
