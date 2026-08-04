import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { completeWorkflowAction } from '../../server/services/postWorkflowService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function readOption(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

async function readOutcome(file) {
    if (!file) return {};
    const raw = await readFile(path.resolve(file), 'utf8');
    if (Buffer.byteLength(raw) > 64 * 1024) throw new Error('Action outcome must be 64 KB or smaller');
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Action outcome must be a JSON object');
    return value;
}

async function main() {
    const args = process.argv.slice(2);
    const agentIndex = args.indexOf('--agent');
    const status = readOption(args, '--status');
    if (!args[0] || !args[1] || agentIndex < 0 || !args[agentIndex + 1] || !status) {
        throw new Error('Usage: agent:complete-action <workflow-id> <action-type> --agent <identity> --status completed|failed|skipped --file <outcome.json>');
    }
    if (!['completed', 'failed', 'skipped'].includes(status)) throw new Error('Action status must be completed, failed, or skipped');
    const { supabase } = await import('../../server/supabaseClient.js');
    const result = await completeWorkflowAction({
        workflowId: args[0],
        actionType: args[1],
        agentIdentity: args[agentIndex + 1],
        status,
        outcome: await readOutcome(readOption(args, '--file'))
    }, supabase);
    process.stdout.write(`${JSON.stringify({ ok: true, workflow_id: result.id, stage: result.stage, status: result.status, action_plan: result.action_plan })}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main().catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
        process.exitCode = 1;
    });
}
