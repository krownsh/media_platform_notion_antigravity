import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
    claimHermesCronWorkflow,
    DEFAULT_HERMES_CRON_AGENT_ID,
    DEFAULT_HERMES_CRON_LEASE_SECONDS,
    DEFAULT_HERMES_CRON_QUEUE
} from '../../server/services/hermesCronService.js';
import { formatWorkflow } from './next-workflow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

export async function claimCronWorkflow(options = {}, dependencies = {}) {
    const claim = dependencies.claim || claimHermesCronWorkflow;
    const workflow = await claim({
        agentId: options.agentId || DEFAULT_HERMES_CRON_AGENT_ID,
        leaseSeconds: options.leaseSeconds || DEFAULT_HERMES_CRON_LEASE_SECONDS,
        queue: options.queue || DEFAULT_HERMES_CRON_QUEUE
    });
    return {
        ok: true,
        wakeAgent: Boolean(workflow),
        agentId: options.agentId || DEFAULT_HERMES_CRON_AGENT_ID,
        leaseSeconds: Number(options.leaseSeconds || DEFAULT_HERMES_CRON_LEASE_SECONDS),
        queue: options.queue || DEFAULT_HERMES_CRON_QUEUE,
        workflow: workflow ? formatWorkflow(workflow) : null
    };
}

async function main() {
    const args = process.argv.slice(2);
    const result = await claimCronWorkflow({
        agentId: option(args, '--agent') || process.env.HERMES_CRON_AGENT_ID || DEFAULT_HERMES_CRON_AGENT_ID,
        leaseSeconds: option(args, '--lease-seconds') || process.env.HERMES_CRON_LEASE_SECONDS || DEFAULT_HERMES_CRON_LEASE_SECONDS,
        queue: option(args, '--queue') || process.env.HERMES_CRON_QUEUE || DEFAULT_HERMES_CRON_QUEUE
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main().catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, wakeAgent: false, code: error.code || 'HERMES_CRON_CLAIM_FAILED', error: error.message })}\n`);
        process.exitCode = 1;
    });
}
