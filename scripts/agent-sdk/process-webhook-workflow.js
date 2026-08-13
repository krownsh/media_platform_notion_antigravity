import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadWorkflow } from '../../server/services/postWorkflowService.js';
import { triageWorkflow } from './triage-workflow.js';
import {
    startHermesAgentRun
} from '../../server/services/hermesDispatchService.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value, label) {
    const normalized = String(value || '').trim();
    if (!UUID_PATTERN.test(normalized)) throw new Error(`${label} must be a UUID`);
    return normalized;
}

export function classifyWebhookWorkflow(workflow) {
    if (!workflow?.id) throw new Error('workflow is required');

    if (workflow.stage === 'triage' && ['pending', 'failed'].includes(workflow.status)) {
        return { action: 'triage' };
    }
    if (workflow.stage === 'base_analysis' && ['pending', 'failed'].includes(workflow.status)) {
        return { action: 'agent_required', reason: 'base_analysis' };
    }
    if (workflow.status === 'processing') {
        return { action: 'in_progress', reason: workflow.stage };
    }
    if (workflow.status === 'awaiting_user') {
        return { action: 'awaiting_user', reason: workflow.stage };
    }
    if (['completed', 'blocked'].includes(workflow.status) || workflow.stage === 'complete') {
        return { action: 'terminal', reason: workflow.status };
    }
    return { action: 'agent_required', reason: workflow.stage };
}

async function loadWorkflowFromDatabase(workflowId) {
    const { supabase } = await import('../../server/supabaseClient.js');
    return loadWorkflow(workflowId, supabase);
}

export async function processWebhookWorkflow(input, dependencies = {}) {
    const workflowId = requireUuid(input?.workflowId, 'workflow id');
    const dispatchId = requireUuid(input?.dispatchId, 'dispatch id');
    const agentIdentity = `hermes:webhook:${dispatchId}`;
    const load = dependencies.load || loadWorkflowFromDatabase;
    const triage = dependencies.triage || triageWorkflow;
    const startAgent = dependencies.startAgent || startHermesAgentRun;

    const workflow = await load(workflowId);
    const decision = classifyWebhookWorkflow(workflow);

    if (['triage', 'agent_required'].includes(decision.action)) {
        await startAgent({ dispatchId, agentId: agentIdentity });
    }

    if (decision.action === 'triage') {
        const result = await triage(workflowId, { agentIdentity, dispatchId });
        return {
            ok: true,
            action: 'triaged',
            dispatch_id: dispatchId,
            agent_identity: agentIdentity,
            ...result
        };
    }

    return {
        ok: true,
        action: decision.action,
        reason: decision.reason,
        dispatch_id: dispatchId,
        workflow_id: workflowId,
        stage: workflow.stage,
        status: workflow.status,
        agent_status: decision.action === 'agent_required' ? 'processing' : null,
        finish_command: decision.action === 'agent_required'
            ? `npm run agent:finish -- ${workflowId} ${dispatchId} --agent ${agentIdentity} --status awaiting_user`
            : null
    };
}

function parseArguments(args) {
    const dispatchIndex = args.indexOf('--dispatch');
    return {
        workflowId: args[0],
        dispatchId: dispatchIndex >= 0 ? args[dispatchIndex + 1] : null
    };
}

const isMainModule = process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    processWebhookWorkflow(parseArguments(process.argv.slice(2)))
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({
                ok: false,
                code: error.code || 'WEBHOOK_WORKFLOW_FAILED',
                error: error.message
            })}\n`);
            process.exitCode = 1;
        });
}
