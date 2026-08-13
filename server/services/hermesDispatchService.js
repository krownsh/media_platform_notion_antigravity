import { supabase } from '../supabaseClient.js';

function requireWorkerId(value) {
    const workerId = String(value || '').trim();
    if (!/^[a-zA-Z0-9._:@/-]{1,128}$/.test(workerId)) {
        throw new Error('Hermes dispatch worker identity is invalid');
    }
    return workerId;
}
function requireDispatchId(value) {
    const dispatchId = String(value || '').trim();
    if (!dispatchId) throw new Error('Hermes dispatch id is required');
    return dispatchId;
}

function assertRpcResult(data, error, action) {
    if (error) {
        const dispatchError = new Error(`${action} failed: ${error.message}`);
        dispatchError.code = error.code;
        throw dispatchError;
    }
    return data || null;
}

export async function claimHermesDispatch(workerId, leaseSeconds = 1_800, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .rpc('claim_collection_hermes_dispatch', {
            p_worker_id: requireWorkerId(workerId),
            p_lease_seconds: leaseSeconds
        })
        .maybeSingle();
    if (error) return assertRpcResult(data, error, 'Hermes dispatch claim');
    // RPC returns all-null row when nothing to claim; treat as empty
    if (!data?.id) return null;
    return data;
}

export async function startHermesAgentRun(input, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .rpc('start_collection_hermes_agent', {
            p_dispatch_id: requireDispatchId(input?.dispatchId),
            p_agent_id: requireWorkerId(input?.agentId),
            p_lease_seconds: Number(input?.leaseSeconds) || 1_800
        })
        .single();
    return assertRpcResult(data, error, 'Hermes agent start');
}

export async function heartbeatHermesAgentRun(input, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .rpc('heartbeat_collection_hermes_agent', {
            p_dispatch_id: requireDispatchId(input?.dispatchId),
            p_agent_id: requireWorkerId(input?.agentId),
            p_lease_seconds: Number(input?.leaseSeconds) || 1_800
        })
        .single();
    return assertRpcResult(data, error, 'Hermes agent heartbeat');
}

export async function finishHermesAgentRun(input, supabaseClient = supabase) {
    const resultStatus = String(input?.status || '').trim();
    if (!['awaiting_user', 'completed', 'failed'].includes(resultStatus)) {
        throw new Error('Hermes agent result status must be awaiting_user, completed, or failed');
    }
    const { data, error } = await supabaseClient
        .rpc('finish_collection_hermes_agent', {
            p_dispatch_id: requireDispatchId(input?.dispatchId),
            p_agent_id: requireWorkerId(input?.agentId),
            p_result_status: resultStatus,
            p_error_message: String(input?.errorMessage || '').slice(0, 4_000)
        })
        .single();
    return assertRpcResult(data, error, 'Hermes agent completion');
}

export async function completeHermesDispatch(input, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .rpc('complete_collection_hermes_dispatch', {
            p_dispatch_id: requireDispatchId(input?.dispatchId),
            p_worker_id: requireWorkerId(input?.workerId),
            p_http_status: Number(input?.httpStatus) || 202
        })
        .single();
    return assertRpcResult(data, error, 'Hermes dispatch completion');
}

export async function failHermesDispatch(input, supabaseClient = supabase) {
    const { data, error } = await supabaseClient
        .rpc('fail_collection_hermes_dispatch', {
            p_dispatch_id: requireDispatchId(input?.dispatchId),
            p_worker_id: requireWorkerId(input?.workerId),
            p_retryable: input?.retryable !== false,
            p_http_status: Number.isInteger(input?.httpStatus) ? input.httpStatus : null,
            p_error_message: String(input?.errorMessage || 'Hermes webhook dispatch failed').slice(0, 4000)
        })
        .single();
    return assertRpcResult(data, error, 'Hermes dispatch failure update');
}
