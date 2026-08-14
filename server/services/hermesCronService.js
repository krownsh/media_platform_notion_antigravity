import { supabase } from '../supabaseClient.js';
import { loadWorkflow } from './postWorkflowService.js';

export const DEFAULT_HERMES_CRON_AGENT_ID = 'hermes:cron:media-inbox';
export const DEFAULT_HERMES_CRON_LEASE_SECONDS = 1_800;
export const DEFAULT_HERMES_CRON_QUEUE = 'preprocess';

const CRON_QUEUES = new Set(['preprocess', 'research', 'vault_sync']);

function normalizeIdentity(value) {
    const identity = String(value || '').trim();
    if (!/^[a-zA-Z0-9._:@/-]{1,128}$/.test(identity)) {
        throw new Error('Hermes Cron agent identity is invalid');
    }
    return identity;
}

function normalizeLeaseSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_HERMES_CRON_LEASE_SECONDS;
    return Math.min(Math.max(Math.round(parsed), 60), 7_200);
}

function normalizeQueue(value) {
    const queue = String(value || DEFAULT_HERMES_CRON_QUEUE).trim().toLowerCase();
    if (!CRON_QUEUES.has(queue)) throw new Error(`Hermes Cron queue is invalid: ${queue}`);
    return queue;
}

function firstRpcRow(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
}

export async function claimHermesCronWorkflow(input = {}, supabaseClient = supabase) {
    const agentId = normalizeIdentity(input.agentId || DEFAULT_HERMES_CRON_AGENT_ID);
    const leaseSeconds = normalizeLeaseSeconds(input.leaseSeconds);
    const queue = normalizeQueue(input.queue);
    const { data, error } = await supabaseClient.rpc('claim_collection_hermes_cron_workflow', {
        p_agent_id: agentId,
        p_lease_seconds: leaseSeconds,
        p_queue: queue
    });
    if (error) throw new Error(`Hermes Cron claim failed: ${error.message}`);
    const row = firstRpcRow(data);
    if (!row?.id) return null;
    return loadWorkflow(row.id, supabaseClient);
}

export async function heartbeatHermesCronWorkflow(input = {}, supabaseClient = supabase) {
    const workflowId = String(input.workflowId || '').trim();
    if (!workflowId) throw new Error('workflowId is required');
    const agentId = normalizeIdentity(input.agentId || DEFAULT_HERMES_CRON_AGENT_ID);
    const leaseSeconds = normalizeLeaseSeconds(input.leaseSeconds);
    const { data, error } = await supabaseClient.rpc('heartbeat_collection_hermes_cron_workflow', {
        p_workflow_id: workflowId,
        p_agent_id: agentId,
        p_lease_seconds: leaseSeconds
    });
    if (error) throw new Error(`Hermes Cron heartbeat failed: ${error.message}`);
    const row = firstRpcRow(data);
    if (!row?.id) throw new Error(`Hermes Cron heartbeat returned no workflow: ${workflowId}`);
    return loadWorkflow(row.id, supabaseClient);
}

export async function releaseHermesCronWorkflow(input = {}, supabaseClient = supabase) {
    const workflowId = String(input.workflowId || '').trim();
    if (!workflowId) throw new Error('workflowId is required');
    const agentId = normalizeIdentity(input.agentId || DEFAULT_HERMES_CRON_AGENT_ID);
    const { data, error } = await supabaseClient.rpc('release_collection_hermes_cron_workflow', {
        p_workflow_id: workflowId,
        p_agent_id: agentId
    });
    if (error) throw new Error(`Hermes Cron lease release failed: ${error.message}`);
    return Boolean(data);
}
