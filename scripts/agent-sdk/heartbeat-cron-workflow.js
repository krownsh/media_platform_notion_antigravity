import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { heartbeatHermesCronWorkflow, DEFAULT_HERMES_CRON_AGENT_ID, DEFAULT_HERMES_CRON_LEASE_SECONDS } from '../../server/services/hermesCronService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

async function main() {
    const args = process.argv.slice(2);
    const workflowId = args[0];
    const agentId = option(args, '--agent') || process.env.HERMES_CRON_AGENT_ID || DEFAULT_HERMES_CRON_AGENT_ID;
    const leaseSeconds = option(args, '--lease-seconds') || process.env.HERMES_CRON_LEASE_SECONDS || DEFAULT_HERMES_CRON_LEASE_SECONDS;
    if (!workflowId) throw new Error('Usage: agent:cron:heartbeat <workflow-id> --agent <identity> [--lease-seconds <seconds>]');
    const workflow = await heartbeatHermesCronWorkflow({ workflowId, agentId, leaseSeconds });
    process.stdout.write(`${JSON.stringify({ ok: true, workflow_id: workflow.id, status: workflow.status, stage: workflow.stage })}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main().catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'HERMES_CRON_HEARTBEAT_FAILED', error: error.message })}\n`);
        process.exitCode = 1;
    });
}
