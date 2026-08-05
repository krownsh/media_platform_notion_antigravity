import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { claimWorkflow, loadWorkflow, transitionWorkflow } from '../../server/services/postWorkflowService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

const ACTION_TYPES = new Set([
    'research',
    'poc_proposal',
    'poc_execute',
    'replication_plan',
    'fast_rewrite',
    'content_synthesis',
    'vault_note'
]);

function readOption(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

export function normalizePlan(value, agentIdentity) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Action plan must be a JSON object');
    const actions = Array.isArray(value.actions) ? value.actions : [];
    const normalized = actions.map(action => {
        const type = String(action?.type || '').trim();
        if (!ACTION_TYPES.has(type)) throw new Error(`Unsupported action type: ${type || 'missing'}`);
        return {
            type,
            status: 'approved',
            requested_by: agentIdentity,
            requested_at: new Date().toISOString(),
            notes: String(action?.notes || '').slice(0, 2000),
            project_target: String(action?.project_target || '').slice(0, 500) || null,
            project_name: String(action?.project_name || '').slice(0, 500) || null
        };
    });
    if (new Set(normalized.map(action => action.type)).size !== normalized.length) {
        throw new Error('An action type may appear only once in an action plan');
    }
    const requestedVaultNote = normalized.find(action => action.type === 'vault_note');
    const withoutVaultNote = normalized.filter(action => action.type !== 'vault_note');
    withoutVaultNote.push({
        ...(requestedVaultNote || {}),
        type: 'vault_note',
        status: 'approved',
        requested_by: agentIdentity,
        requested_at: new Date().toISOString(),
        notes: requestedVaultNote?.notes || 'Mandatory final action: write the post record to Claude-Obsidian.'
    });
    return { schema_version: 2, actions: withoutVaultNote };
}

export async function decideWorkflow(workflowId, options = {}) {
    if (!options.agentIdentity) throw new Error('--agent <identity> is required');
    if (!options.plan) throw new Error('--file <action-plan.json> is required');
    const planRaw = await readFile(path.resolve(options.plan), 'utf8');
    if (Buffer.byteLength(planRaw) > 64 * 1024) throw new Error('Action plan must be 64 KB or smaller');
    const { supabase } = await import('../../server/supabaseClient.js');
    const workflow = await loadWorkflow(workflowId, supabase);
    if (workflow.stage !== 'strategy' || workflow.status !== 'awaiting_user') {
        throw new Error(`Workflow ${workflow.id} is not awaiting a strategy decision (${workflow.stage}/${workflow.status})`);
    }
    const plan = normalizePlan(JSON.parse(planRaw), options.agentIdentity);
    const claimed = await claimWorkflow(workflow, options.agentIdentity, supabase, { allowAwaitingUser: true });
    const transitioned = await transitionWorkflow({
        workflow: claimed,
        agentIdentity: options.agentIdentity,
        stage: 'actions',
        status: 'pending',
        actionPlan: plan,
        context: {
            ...(claimed.context || {}),
            strategy: {
                status: 'completed',
                decided_at: new Date().toISOString(),
                decided_by: options.agentIdentity
            }
        }
    }, supabase);
    return {
        ok: true,
        workflow_id: transitioned.id,
        stage: transitioned.stage,
        status: transitioned.status,
        action_plan: transitioned.action_plan
    };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const agentIndex = args.indexOf('--agent');
    decideWorkflow(args[0], { agentIdentity: agentIndex >= 0 ? args[agentIndex + 1] : null, plan: readOption(args, '--file') })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
