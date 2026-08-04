import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { createAndStoreContentRoute } from '../../server/services/contentRouteService.js';
import {
    completeWorkflowAction,
    getWorkflowPost,
    loadWorkflow
} from '../../server/services/postWorkflowService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

const DRAFT_ACTIONS = new Set(['fast_rewrite', 'content_synthesis']);

function actionFor(workflow, actionType) {
    const actions = Array.isArray(workflow?.action_plan?.actions) ? workflow.action_plan.actions : [];
    return actions.find(action => action?.type === actionType) || null;
}

function stringifyWorkflowEvidence(workflow) {
    const actions = Array.isArray(workflow?.action_plan?.actions) ? workflow.action_plan.actions : [];
    const evidence = actions
        .filter(action => ['research', 'poc_proposal', 'poc_execute'].includes(action?.type) && action.status === 'completed')
        .map(action => ({ type: action.type, notes: action.notes || null, outcome: action.outcome || null }));
    return evidence.length ? JSON.stringify(evidence) : '';
}

export async function createWorkflowDraft(workflowId, actionType, options = {}) {
    if (!options.agentIdentity) throw new Error('--agent <identity> is required');
    if (!DRAFT_ACTIONS.has(actionType)) throw new Error('Draft action must be fast_rewrite or content_synthesis');
    const { supabase } = await import('../../server/supabaseClient.js');
    const workflow = await loadWorkflow(workflowId, supabase);
    if (workflow.stage !== 'actions' || !['pending', 'failed'].includes(workflow.status)) {
        throw new Error(`Workflow ${workflow.id} is not ready for a draft (${workflow.stage}/${workflow.status})`);
    }
    const action = actionFor(workflow, actionType);
    if (!action || !['approved', 'pending', 'failed'].includes(action.status)) {
        throw new Error(`Workflow ${workflow.id} has no approved ${actionType} action`);
    }
    if (actionType === 'content_synthesis' && !stringifyWorkflowEvidence(workflow)) {
        throw new Error('content_synthesis requires a completed research, POC proposal, or POC execution action first');
    }
    const post = getWorkflowPost(workflow);
    if (!post) throw new Error('Workflow post was not found');
    if (post.platform === 'image' && !post.content) {
        throw new Error('Image base analysis must provide source text before creating a draft');
    }

    const routeType = actionType === 'fast_rewrite' ? 'quick_rewrite' : 'content_synthesis';
    const storedDraft = await createAndStoreContentRoute({
        postData: post,
        routeType,
        routeState: workflow.action_plan,
        workflowContext: actionType === 'content_synthesis' ? stringifyWorkflowEvidence(workflow) : null
    }, { supabaseClient: supabase });
    const completed = await completeWorkflowAction({
        workflowId,
        actionType,
        agentIdentity: options.agentIdentity,
        status: 'completed',
        outcome: {
            content_asset_id: storedDraft.content_asset_id,
            content_revision_id: storedDraft.content_revision_id,
            revision_number: storedDraft.revision_number,
            idempotency_key: storedDraft.idempotency_key,
            content_basis: actionType === 'fast_rewrite' ? 'source_only' : 'researched',
            published: false
        }
    }, supabase);
    return {
        ok: true,
        workflow_id: completed.id,
        stage: completed.stage,
        status: completed.status,
        content_asset_id: storedDraft.content_asset_id,
        content_revision_id: storedDraft.content_revision_id,
        content_basis: actionType === 'fast_rewrite' ? 'source_only' : 'researched'
    };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const agentIndex = args.indexOf('--agent');
    createWorkflowDraft(args[0], args[1], { agentIdentity: agentIndex >= 0 ? args[agentIndex + 1] : null })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
