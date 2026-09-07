import { supabase } from '../supabaseClient.js';
import { normalizePreprocessInput } from './autonomyPolicyService.js';
import { persistGeneratedTitle } from './autonomousKnowledgeService.js';
import { getWorkflowPost, loadWorkflow } from './postWorkflowService.js';

const IDENTITY_PATTERN = /^[a-zA-Z0-9._:@/-]{1,128}$/;

function normalizeIdentity(value) {
    const identity = String(value || 'codex:db-preprocess').trim();
    if (!IDENTITY_PATTERN.test(identity)) throw new Error('Codex agent identity is invalid');
    return identity;
}

export async function stageCodexPreprocessWorkflow(input = {}, supabaseClient = supabase) {
    const workflowId = String(input.workflowId || '').trim();
    if (!workflowId) throw new Error('workflowId is required');
    const normalized = normalizePreprocessInput(input.result || {});
    const needsGeneratedTitle = Boolean(normalized.analysis.generated_title);
    let post = null;
    if (needsGeneratedTitle) {
        try {
            post = getWorkflowPost(await loadWorkflow(workflowId, supabaseClient));
        } catch (error) {
            console.warn(`[CodexPreprocess] Generated title preparation deferred: ${error.message}`);
        }
    }
    if (post && !String(post.title || '').trim() && !normalized.folder.note_title) {
        normalized.folder.note_title = normalized.analysis.generated_title;
    }
    // Stage M predates project-first governance and creates agent_auto topics
    // when p_result.topic is present. Keep the model proposal as auditable
    // context, but never pass it to that write path.
    const topicProposal = normalized.topic?.suggested_title
        ? { topic: normalized.topic, relation: normalized.relation || null }
        : null;
    const result = {
        ...normalized,
        topic: null,
        relation: null,
        topic_proposal: topicProposal
    };
    const agentId = normalizeIdentity(input.agentId);
    const { data, error } = await supabaseClient.rpc('codex_stage_collection_preprocess', {
        p_workflow_id: workflowId,
        p_result: result,
        p_agent_id: agentId
    });
    if (error) throw new Error(`Codex remote preprocess failed: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.workflow_id) throw new Error(`Codex remote preprocess returned no workflow: ${workflowId}`);
    if (post) {
        await persistGeneratedTitle(post, normalized.analysis.generated_title, supabaseClient, 'codex_db_preprocess')
            .catch(error => console.warn(`[CodexPreprocess] Generated title persistence deferred: ${error.message}`));
    }
    return row;
}
