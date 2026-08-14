import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
    loadWorkflow,
    transitionWorkflow
} from '../../server/services/postWorkflowService.js';
import {
    releaseHermesCronWorkflow
} from '../../server/services/hermesCronService.js';
import { writeWorkflowVaultNotes } from '../../server/services/vaultNoteService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

const TARGETS = new Set(['complete/completed', 'research/pending', 'review/awaiting_user']);

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

function completedVaultActionPlan(actionPlan, outcome, agentIdentity) {
    const plan = actionPlan && typeof actionPlan === 'object' ? actionPlan : {};
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    let found = false;
    const nextActions = actions.map(action => {
        if (action?.type !== 'vault_note') return action;
        found = true;
        return {
            ...action,
            status: 'completed',
            completed_by: agentIdentity,
            completed_at: new Date().toISOString(),
            outcome
        };
    });
    if (!found) {
        nextActions.push({
            type: 'vault_note',
            status: 'completed',
            requested_by: 'codex:db-preprocess',
            requested_at: new Date().toISOString(),
            completed_by: agentIdentity,
            completed_at: new Date().toISOString(),
            outcome
        });
    }
    return { schema_version: 2, actions: nextActions };
}

export async function syncVaultWorkflow(workflowId, options = {}) {
    if (!options.agentIdentity) throw new Error('--agent <identity> is required');
    const { supabase: defaultSupabase } = await import('../../server/supabaseClient.js');
    const supabaseClient = options.supabaseClient || defaultSupabase;
    let workflow = await loadWorkflow(workflowId, supabaseClient);
    if (workflow.stage !== 'vault_sync' || workflow.status !== 'processing'
        || workflow.locked_by !== options.agentIdentity) {
        throw new Error(`Workflow ${workflow.id} is not leased for Vault sync by ${options.agentIdentity}`);
    }

    try {
        const sync = workflow.context?.vault_sync;
        if (!sync || typeof sync.note_input !== 'object') {
            throw new Error('Workflow has no deferred Vault note input');
        }
        const target = `${sync.target_stage}/${sync.target_status}`;
        if (!TARGETS.has(target)) throw new Error(`Invalid deferred Vault target: ${target}`);

        const vaultOutcome = await writeWorkflowVaultNotes({
            workflow,
            noteInput: sync.note_input,
            vaultRoot: options.vaultRoot
        });
        const context = {
            ...(workflow.context || {}),
            vault: vaultOutcome,
            vault_sync: {
                ...sync,
                status: 'completed',
                relative_path: vaultOutcome.relative_path,
                completed_at: new Date().toISOString(),
                completed_by: options.agentIdentity
            }
        };
        const transitioned = await transitionWorkflow({
            workflow,
            agentIdentity: options.agentIdentity,
            stage: sync.target_stage,
            status: sync.target_status,
            context,
            actionPlan: completedVaultActionPlan(workflow.action_plan, vaultOutcome, options.agentIdentity),
            failedStage: null,
            lastError: null
        }, supabaseClient);
        await releaseHermesCronWorkflow({ workflowId: transitioned.id, agentId: options.agentIdentity }, supabaseClient);
        return {
            ok: true,
            workflow_id: transitioned.id,
            stage: transitioned.stage,
            status: transitioned.status,
            vault_path: vaultOutcome.relative_path
        };
    } catch (error) {
        try {
            workflow = await loadWorkflow(workflowId, supabaseClient);
            if (workflow.status === 'processing' && workflow.locked_by === options.agentIdentity) {
                await transitionWorkflow({
                    workflow,
                    agentIdentity: options.agentIdentity,
                    stage: 'vault_sync',
                    status: 'failed',
                    failedStage: 'vault_sync',
                    lastError: error.message
                }, supabaseClient);
            }
        } catch (persistError) {
            console.error(`[Hermes Vault Sync] Failed to persist error: ${persistError.message}`);
        }
        await releaseHermesCronWorkflow({ workflowId, agentId: options.agentIdentity }, supabaseClient).catch(() => {});
        throw error;
    }
}

const isMainModule = process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    syncVaultWorkflow(args[0], {
        agentIdentity: option(args, '--agent'),
        vaultRoot: option(args, '--vault')
    })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'VAULT_SYNC_FAILED', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
