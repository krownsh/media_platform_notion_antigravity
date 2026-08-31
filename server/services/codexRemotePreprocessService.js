import { supabase } from '../supabaseClient.js';
import { normalizePreprocessInput } from './autonomyPolicyService.js';

const IDENTITY_PATTERN = /^[a-zA-Z0-9._:@/-]{1,128}$/;

function normalizeIdentity(value) {
    const identity = String(value || 'codex:db-preprocess').trim();
    if (!IDENTITY_PATTERN.test(identity)) throw new Error('Codex agent identity is invalid');
    return identity;
}

export async function stageCodexPreprocessWorkflow(input = {}, supabaseClient = supabase) {
    const workflowId = String(input.workflowId || '').trim();
    if (!workflowId) throw new Error('workflowId is required');
    const result = normalizePreprocessInput(input.result || {});
    const agentId = normalizeIdentity(input.agentId);
    const { data, error } = await supabaseClient.rpc('codex_stage_collection_preprocess', {
        p_workflow_id: workflowId,
        p_result: result,
        p_agent_id: agentId
    });
    if (error) throw new Error(`Codex remote preprocess failed: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.workflow_id) throw new Error(`Codex remote preprocess returned no workflow: ${workflowId}`);
    return row;
}
