import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { releaseHermesCronWorkflow, DEFAULT_HERMES_CRON_AGENT_ID } from '../../server/services/hermesCronService.js';

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
    if (!workflowId) throw new Error('Usage: agent:cron:release <workflow-id> --agent <identity>');
    const released = await releaseHermesCronWorkflow({ workflowId, agentId });
    process.stdout.write(`${JSON.stringify({ ok: released, workflow_id: workflowId, released })}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main().catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'HERMES_CRON_RELEASE_FAILED', error: error.message })}\n`);
        process.exitCode = 1;
    });
}
