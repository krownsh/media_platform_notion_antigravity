import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { completeWorkflowAction, loadWorkflow } from '../../server/services/postWorkflowService.js';
import { validateIntegrationTestPlan } from '../../server/services/pocIntegrationPlan.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function readOption(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

async function readProposal(file) {
    if (!file) throw new Error('--file <proposal.json> is required');
    const raw = await readFile(path.resolve(file), 'utf8');
    if (Buffer.byteLength(raw) > 64 * 1024) throw new Error('POC proposal must be 64 KB or smaller');
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('POC proposal must be a JSON object');
    }
    return value;
}

export async function recordPocProposal(workflowId, options = {}) {
    if (!options.agentIdentity) throw new Error('--agent <identity> is required');
    const { supabase } = await import('../../server/supabaseClient.js');
    const workflow = await loadWorkflow(workflowId, supabase);
    if (workflow.stage !== 'actions' || !['pending', 'failed'].includes(workflow.status)) {
        throw new Error(`Workflow ${workflow.id} is not ready for a POC proposal (${workflow.stage}/${workflow.status})`);
    }
    const action = (workflow.action_plan?.actions || []).find(item => item?.type === 'poc_proposal');
    if (!action || !['approved', 'pending', 'failed'].includes(action.status)) {
        throw new Error(`Workflow ${workflow.id} has no approved poc_proposal action`);
    }
    const outcome = await readProposal(options.file);
    const testPlan = validateIntegrationTestPlan(outcome.test_plan);
    const completed = await completeWorkflowAction({
        workflowId,
        actionType: 'poc_proposal',
        agentIdentity: options.agentIdentity,
        status: 'completed',
        outcome: {
            ...outcome,
            test_plan: testPlan,
            requires_explicit_execution_confirmation: true,
            execution_command: `npm run agent:poc:run -- ${workflowId} --agent ${options.agentIdentity} --confirmation EXECUTE_POC`
        }
    }, supabase);
    return {
        ok: true,
        workflow_id: completed.id,
        stage: completed.stage,
        status: completed.status,
        action_plan: completed.action_plan
    };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const agentIndex = args.indexOf('--agent');
    recordPocProposal(args[0], {
        agentIdentity: agentIndex >= 0 ? args[agentIndex + 1] : null,
        file: readOption(args, '--file')
    })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
