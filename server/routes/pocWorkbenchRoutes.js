import express from 'express';
import { supabase } from '../supabaseClient.js';
import { runWorkflowPoc } from '../../scripts/agent-sdk/run-poc-workflow.js';

export const pocWorkbenchRouter = express.Router();

async function loadWorkbench(userId, postId) {
  const { data: post, error: postError } = await supabase
    .from('collection_posts')
    .select('id, collection_post_analysis(insights), collection_post_workflows(*)')
    .eq('id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (postError) throw postError;
  if (!post) return null;

  const workflow = Array.isArray(post.collection_post_workflows)
    ? post.collection_post_workflows[0]
    : post.collection_post_workflows;

  const analysis = Array.isArray(post.collection_post_analysis)
    ? post.collection_post_analysis[0]
    : post.collection_post_analysis;
  const insights = Array.isArray(analysis?.insights) ? analysis.insights : [];
  const actions = Array.isArray(workflow?.action_plan?.actions) ? workflow.action_plan.actions : [];
  const proposalAction = actions.find(item => item?.type === 'poc_proposal');
  const executeAction = actions.find(item => item?.type === 'poc_execute');
  const successfulRun = insights.find(item => item?.type === 'poc_run' && item?.status === 'success')
    || (executeAction?.outcome?.status === 'success' ? executeAction.outcome : null);

  return {
    post_id: post.id,
    workflow_id: workflow?.id || null,
    current_project_target: null,
    eligible_for_proposal: Boolean(proposalAction && ['approved', 'pending', 'failed'].includes(proposalAction.status)),
    scope: null,
    route: proposalAction ? { status: proposalAction.status, outcome: proposalAction.outcome || null } : null,
    execute_action: executeAction ? { status: executeAction.status, outcome: executeAction.outcome || null } : null,
    successful_run: successfulRun ? { run_id: successfulRun.run_id, status: successfulRun.status } : null
  };
}

pocWorkbenchRouter.get('/:postId', async (req, res) => {
  try {
    const state = await loadWorkbench(req.auth.userId, req.params.postId);
    if (!state) return res.status(404).json({ error: 'Post not found' });
    return res.json(state);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

pocWorkbenchRouter.post('/:postId/proposal', async (req, res) => {
  try {
    const state = await loadWorkbench(req.auth.userId, req.params.postId);
    if (!state) return res.status(404).json({ error: 'Post not found' });
    return res.status(409).json({
      error: 'POC proposals are created during Hermes strategy discussion. Persist the approved proposal with agent:poc:propose.'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

pocWorkbenchRouter.post('/:postId/execute', async (req, res) => {
  if (req.body?.confirmation !== 'EXECUTE_POC') {
    return res.status(400).json({ error: 'Explicit EXECUTE_POC confirmation is required.' });
  }
  try {
    const state = await loadWorkbench(req.auth.userId, req.params.postId);
    if (!state) return res.status(404).json({ error: 'Post not found' });
    if (!state.workflow_id || !state.execute_action || !['approved', 'pending', 'failed'].includes(state.execute_action.status)) {
      return res.status(409).json({ error: 'This source has no approved poc_execute workflow action.' });
    }
    const run = await runWorkflowPoc(state.workflow_id, {
      agentIdentity: 'api:poc-workbench',
      confirmation: 'EXECUTE_POC'
    });
    return res.json({ ...await loadWorkbench(req.auth.userId, req.params.postId), run });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
