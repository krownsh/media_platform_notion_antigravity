import path from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { finishHermesAgentRun } from '../../server/services/hermesDispatchService.js';
import { dispatchNext } from './dispatch-next.js';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env'), quiet: true });

function readOption(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

export async function finishAgentRun(input, dependencies = {}) {
    const finish = dependencies.finish || finishHermesAgentRun;
    const dispatch = dependencies.dispatch || dispatchNext;
    const result = await finish({
        dispatchId: input.dispatchId,
        agentId: input.agentId,
        status: input.status,
        errorMessage: input.errorMessage
    });
    let next = null;
    let nextError = null;
    try {
        next = await dispatch({ workerId: `hermes:completion:${input.dispatchId}` });
    } catch (error) {
        // Finishing this Agent run is durable. A later Hermes Cron/manual wake
        // can retry the next pending dispatch without reopening this one.
        nextError = error.message;
    }
    return { result, next, next_error: nextError };
}

async function main() {
    const args = process.argv.slice(2);
    const workflowId = args[0];
    const dispatchId = args[1];
    const agentId = readOption(args, '--agent');
    const status = readOption(args, '--status');
    const errorMessage = readOption(args, '--error');
    if (!workflowId || !dispatchId || !agentId || !status) {
        throw new Error('Usage: agent:finish <workflow-id> <dispatch-id> --agent <identity> --status awaiting_user|completed|failed [--error <message>]');
    }
    const output = await finishAgentRun({ workflowId, dispatchId, agentId, status, errorMessage });
    process.stdout.write(`${JSON.stringify({ ok: true, workflow_id: workflowId, ...output })}\n`);
}

const isMainModule = process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main().catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'HERMES_AGENT_FINISH_FAILED', error: error.message })}\n`);
        process.exitCode = 1;
    });
}
