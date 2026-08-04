import { supabase } from '../supabaseClient.js';

export const WORKFLOW_STAGES = new Set(['base_analysis', 'triage', 'strategy', 'actions', 'complete']);
export const WORKFLOW_STATUSES = new Set(['pending', 'processing', 'awaiting_user', 'completed', 'failed', 'blocked']);

const MAX_ERROR_LENGTH = 4_000;
const WORKFLOW_SELECT = `
  id, user_id, post_id, outbox_event_id, source_type, stage, status,
  context, action_plan, attempt_count, max_attempts, available_at,
  locked_at, locked_by, failed_stage, last_error, completed_at,
  created_at, updated_at,
  collection_posts (
    id, platform, original_url, title, author_name, content, collection_id,
    collection_post_media (*),
    collection_post_analysis (*)
  )
`;

function requireWorkflowStage(value) {
    if (!WORKFLOW_STAGES.has(value)) throw new Error(`Unsupported workflow stage: ${value}`);
    return value;
}

function requireWorkflowStatus(value) {
    if (!WORKFLOW_STATUSES.has(value)) throw new Error(`Unsupported workflow status: ${value}`);
    return value;
}

function normalizeIdentity(value) {
    const identity = String(value || '').trim();
    if (!/^[a-zA-Z0-9._:@/-]{1,128}$/.test(identity)) {
        throw new Error('Workflow agent identity is invalid');
    }
    return identity;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function workflowPost(workflow) {
    return Array.isArray(workflow?.collection_posts)
        ? workflow.collection_posts[0]
        : workflow?.collection_posts;
}

async function loadWorkflowByOutbox(outboxEventId, supabaseClient) {
    const { data, error } = await supabaseClient
        .from('collection_post_workflows')
        .select(WORKFLOW_SELECT)
        .eq('outbox_event_id', outboxEventId)
        .maybeSingle();
    if (error) throw new Error(`Workflow lookup failed: ${error.message}`);
    if (!data) throw new Error(`Workflow was not initialized for outbox ${outboxEventId}`);
    return data;
}

export async function loadWorkflow(workflowId, supabaseClient = supabase) {
    const id = String(workflowId || '').trim();
    if (!id) throw new Error('workflowId is required');
    const { data, error } = await supabaseClient
        .from('collection_post_workflows')
        .select(WORKFLOW_SELECT)
        .eq('id', id)
        .maybeSingle();
    if (error) throw new Error(`Workflow lookup failed: ${error.message}`);
    if (!data) throw new Error(`Workflow ${id} was not found`);
    return data;
}

export async function updateWorkflowAfterCapture(input, supabaseClient = supabase) {
    const outboxEventId = String(input?.outboxEventId || '').trim();
    if (!outboxEventId) throw new Error('outboxEventId is required');
    const sourceType = input?.sourceType === 'image_upload' ? 'image_upload' : 'url_capture';
    const baseStatus = input?.baseAnalysis?.status === 'completed' ? 'completed' : 'pending';
    const current = await loadWorkflowByOutbox(outboxEventId, supabaseClient);
    const context = {
        ...asObject(current.context),
        base_analysis: {
            ...asObject(current.context?.base_analysis),
            ...asObject(input?.baseAnalysis),
            status: sourceType === 'image_upload' ? 'pending' : baseStatus
        }
    };
    const update = {
        source_type: sourceType,
        stage: sourceType === 'image_upload' || baseStatus !== 'completed' ? 'base_analysis' : 'triage',
        status: 'pending',
        context,
        failed_stage: null,
        last_error: null,
        available_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null
    };
    const { data, error } = await supabaseClient
        .from('collection_post_workflows')
        .update(update)
        .eq('id', current.id)
        .eq('updated_at', current.updated_at)
        .select(WORKFLOW_SELECT)
        .single();
    if (error || !data) throw new Error(`Workflow capture update failed: ${error?.message || 'no row updated'}`);
    return data;
}

export async function markImageWorkflowAnalyzed(input, supabaseClient = supabase) {
    const workflow = await loadWorkflowByOutbox(input?.outboxEventId, supabaseClient);
    const identity = normalizeIdentity(input?.agentIdentity);
    const context = {
        ...asObject(workflow.context),
        base_analysis: {
            ...asObject(workflow.context?.base_analysis),
            status: 'completed',
            source: 'hermes_image',
            agent: identity,
            analysis_id: input.analysisId || null,
            completed_at: new Date().toISOString()
        }
    };
    const { data, error } = await supabaseClient
        .from('collection_post_workflows')
        .update({
            stage: 'triage',
            status: 'pending',
            context,
            failed_stage: null,
            last_error: null,
            available_at: new Date().toISOString(),
            locked_at: null,
            locked_by: null
        })
        .eq('id', workflow.id)
        .eq('updated_at', workflow.updated_at)
        .select(WORKFLOW_SELECT)
        .single();
    if (error || !data) throw new Error(`Workflow image transition failed: ${error?.message || 'no row updated'}`);
    return data;
}

export async function markAnalysisProvenance(input, supabaseClient = supabase) {
    const analysisId = String(input?.analysisId || '').trim();
    if (!analysisId) throw new Error('analysisId is required');
    const { data, error } = await supabaseClient
        .from('collection_post_analysis')
        .update({
            analysis_status: input.status || 'completed',
            analysis_source: input.source || 'hermes_image',
            analyzed_at: new Date().toISOString()
        })
        .eq('id', analysisId)
        .select('id, analysis_status, analysis_source, analyzed_at')
        .single();
    if (error || !data) throw new Error(`Analysis provenance update failed: ${error?.message || 'no row updated'}`);
    return data;
}

export async function selectNextWorkflow(options = {}, supabaseClient = supabase) {
    const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
    const staleBefore = new Date(new Date(now).getTime() - 15 * 60_000).toISOString();
    const query = (status) => supabaseClient
        .from('collection_post_workflows')
        .select(WORKFLOW_SELECT)
        .eq('status', status)
        .lte('available_at', now)
        .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
        .order(status === 'failed' ? 'updated_at' : 'created_at', { ascending: false })
        .limit(status === 'failed' ? 20 : 1);

    const { data: failed, error: failedError } = await query('failed');
    if (failedError) throw new Error(`Workflow failure lookup failed: ${failedError.message}`);
    const retryableFailure = (failed || []).find(item => (
        Number(item.attempt_count || 0) < Number(item.max_attempts || 3)
    ));
    if (retryableFailure) {
        return { workflow: retryableFailure, selection: 'retry_failed' };
    }

    if (options.interactive) {
        const { data: awaiting, error: awaitingError } = await query('awaiting_user');
        if (awaitingError) throw new Error(`Workflow decision lookup failed: ${awaitingError.message}`);
        if (awaiting?.[0]) return { workflow: awaiting[0], selection: 'awaiting_user' };
    }

    const { data: pending, error: pendingError } = await query('pending');
    if (pendingError) throw new Error(`Workflow pending lookup failed: ${pendingError.message}`);
    return pending?.[0] ? { workflow: pending[0], selection: 'latest_pending' } : null;
}

export async function claimWorkflow(workflow, agentIdentity, supabaseClient = supabase, options = {}) {
    const identity = normalizeIdentity(agentIdentity);
    if (!workflow?.id || !workflow?.updated_at) throw new Error('Workflow id and updated_at are required to claim');
    const claimableStatuses = options.allowAwaitingUser
        ? ['pending', 'failed', 'awaiting_user']
        : ['pending', 'failed'];
    if (!claimableStatuses.includes(workflow.status)) throw new Error(`Workflow ${workflow.id} is not claimable (${workflow.status})`);
    const { data, error } = await supabaseClient
        .from('collection_post_workflows')
        .update({
            status: 'processing',
            locked_at: new Date().toISOString(),
            locked_by: identity,
            attempt_count: Number(workflow.attempt_count || 0) + 1,
            last_error: null
        })
        .eq('id', workflow.id)
        .eq('updated_at', workflow.updated_at)
        .in('status', claimableStatuses)
        .select(WORKFLOW_SELECT)
        .maybeSingle();
    if (error || !data) throw new Error(`Workflow claim conflict: ${error?.message || 'another agent changed this workflow'}`);
    return data;
}

export async function transitionWorkflow(input, supabaseClient = supabase) {
    const workflow = input?.workflow;
    const identity = normalizeIdentity(input?.agentIdentity);
    if (!workflow?.id || !workflow?.updated_at) throw new Error('Workflow id and updated_at are required to transition');
    if (workflow.locked_by !== identity) throw new Error(`Workflow ${workflow.id} is not leased by ${identity}`);
    const stage = requireWorkflowStage(input.stage || workflow.stage);
    const requestedStatus = requireWorkflowStatus(input.status);
    const status = requestedStatus === 'failed'
        && Number(workflow.attempt_count || 0) >= Number(workflow.max_attempts || 3)
        ? 'blocked'
        : requestedStatus;
    const context = input.context === undefined ? workflow.context : input.context;
    const actionPlan = input.actionPlan === undefined ? workflow.action_plan : input.actionPlan;
    const terminal = status === 'completed' || status === 'blocked';
    const { data, error } = await supabaseClient
        .from('collection_post_workflows')
        .update({
            stage,
            status,
            context: asObject(context),
            action_plan: asObject(actionPlan),
            failed_stage: input.failedStage || null,
            last_error: input.lastError ? String(input.lastError).slice(0, MAX_ERROR_LENGTH) : null,
            available_at: input.availableAt || new Date().toISOString(),
            locked_at: null,
            locked_by: null,
            completed_at: terminal ? new Date().toISOString() : null
        })
        .eq('id', workflow.id)
        .eq('updated_at', workflow.updated_at)
        .eq('locked_by', identity)
        .select(WORKFLOW_SELECT)
        .single();
    if (error || !data) throw new Error(`Workflow transition failed: ${error?.message || 'no row updated'}`);
    return data;
}

export async function completeWorkflowAction(input, supabaseClient = supabase) {
    const workflow = await loadWorkflow(input?.workflowId, supabaseClient);
    const identity = normalizeIdentity(input?.agentIdentity);
    if (workflow.stage !== 'actions' || !['pending', 'failed'].includes(workflow.status)) {
        throw new Error(`Workflow ${workflow.id} is not ready for an action (${workflow.stage}/${workflow.status})`);
    }
    const actionType = String(input?.actionType || '').trim();
    if (!actionType) throw new Error('actionType is required');
    const claimed = await claimWorkflow(workflow, identity, supabaseClient);
    const plan = asObject(claimed.action_plan);
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    let found = false;
    const nextActions = actions.map(action => {
        if (action?.type !== actionType) return action;
        found = true;
        return {
            ...action,
            status: input.status,
            completed_by: identity,
            completed_at: new Date().toISOString(),
            outcome: input.outcome || null
        };
    });
    if (!found) throw new Error(`Action ${actionType} is not part of workflow ${workflow.id}`);

    const hasFailure = nextActions.some(action => action?.status === 'failed');
    const hasActive = nextActions.some(action => ['approved', 'pending', 'in_progress'].includes(action?.status));
    const nextStatus = hasFailure ? 'failed' : (hasActive ? 'pending' : 'completed');
    return transitionWorkflow({
        workflow: claimed,
        agentIdentity: identity,
        stage: nextStatus === 'completed' ? 'complete' : 'actions',
        status: nextStatus,
        actionPlan: { ...plan, actions: nextActions },
        failedStage: nextStatus === 'failed' ? 'actions' : null,
        lastError: nextStatus === 'failed' ? String(input?.outcome?.error || 'Workflow action failed') : null
    }, supabaseClient);
}

export function getWorkflowPost(workflow) {
    return workflowPost(workflow);
}
