import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
    claimHermesCronWorkflow,
    DEFAULT_HERMES_CRON_LEASE_SECONDS
} from '../../server/services/hermesCronService.js';
import { syncVaultWorkflow } from './vault-sync-workflow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function option(args, name, fallback = null) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
}

function boundedMax(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 500;
    return Math.min(500, Math.max(1, Math.floor(parsed)));
}

export async function drainVaultSync(options = {}) {
    const agentIdentity = String(options.agentIdentity || 'hermes:manual:vault-sync').trim();
    const maxItems = boundedMax(options.maxItems);
    const supabaseModule = await import('../../server/supabaseClient.js');
    const supabaseClient = options.supabaseClient || supabaseModule.supabase;
    const results = [];

    for (let index = 0; index < maxItems; index += 1) {
        const workflow = await claimHermesCronWorkflow({
            agentId: agentIdentity,
            leaseSeconds: options.leaseSeconds || DEFAULT_HERMES_CRON_LEASE_SECONDS,
            queue: 'vault_sync'
        }, supabaseClient);
        if (!workflow) break;

        try {
            const synced = await syncVaultWorkflow(workflow.id, {
                agentIdentity,
                vaultRoot: options.vaultRoot,
                supabaseClient
            });
            results.push({ workflow_id: synced.id, status: synced.status, stage: synced.stage });
        } catch (error) {
            results.push({ workflow_id: workflow.id, status: 'failed', error: error.message });
            break;
        }
    }

    return {
        ok: results.every(item => item.status !== 'failed'),
        processed: results.filter(item => item.status !== 'failed').length,
        failed: results.filter(item => item.status === 'failed'),
        stopped_when_empty: results.length < maxItems
    };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    drainVaultSync({
        agentIdentity: option(args, '--agent', 'hermes:manual:vault-sync'),
        maxItems: option(args, '--max', '500'),
        vaultRoot: option(args, '--vault')
    })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'VAULT_SYNC_DRAIN_FAILED', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
