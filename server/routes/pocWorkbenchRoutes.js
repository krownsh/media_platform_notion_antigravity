import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { supabase } from '../supabaseClient.js';
import { normalizeGitHubTarget, selectPocTopicScope } from '../services/topicScopeService.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '../..');
const analyzeScript = path.join(projectRoot, 'scripts', 'agent-sdk', 'analyze-item.js');

function getCurrentProjectTarget() {
  try {
    const remoteUrl = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: projectRoot,
      encoding: 'utf8',
      windowsHide: true
    });
    return normalizeGitHubTarget(remoteUrl);
  } catch {
    return null;
  }
}

export const pocWorkbenchRouter = express.Router();

async function loadWorkbench(userId, postId) {
  const { data: post, error: postError } = await supabase
    .from('collection_posts')
    .select('id, collection_id, collection_post_analysis(insights)')
    .eq('id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (postError) throw postError;
  if (!post) return null;

  const { data: outbox, error: outboxError } = await supabase
    .from('collection_capture_outbox')
    .select('id, status, payload')
    .eq('aggregate_id', postId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (outboxError) throw outboxError;

  let scope = null;
  if (post.collection_id) {
    const { data, error } = await supabase
      .from('collection_topic_scopes')
      .select('id, mode, objective, project_targets, is_active')
      .eq('user_id', userId)
      .eq('collection_id', post.collection_id)
      .maybeSingle();
    if (error) throw error;
    scope = data;
  }

  const analysis = Array.isArray(post.collection_post_analysis)
    ? post.collection_post_analysis[0]
    : post.collection_post_analysis;
  const insights = Array.isArray(analysis?.insights) ? analysis.insights : [];
  const successfulRun = insights.find(item => item?.type === 'poc_run' && item?.status === 'success') || null;
  const route = outbox?.payload?.agent_routes?.routes?.find(item => item.type === 'apply_poc') || null;
  const currentProjectTarget = getCurrentProjectTarget();
  const eligibleScope = selectPocTopicScope(scope ? [scope] : [], currentProjectTarget);

  return {
    post_id: post.id,
    outbox_id: outbox?.id || null,
    current_project_target: currentProjectTarget,
    eligible_for_proposal: Boolean(eligibleScope),
    scope: scope ? {
      mode: scope.mode,
      objective: scope.objective,
      project_targets: scope.project_targets || []
    } : null,
    route: route ? { status: route.status, outcome: route.outcome || null } : null,
    successful_run: successfulRun ? { run_id: successfulRun.run_id, status: successfulRun.status } : null
  };
}

async function runAnalyze(outboxId, executePoc) {
  const args = [analyzeScript, outboxId];
  if (executePoc) args.push('--execute-poc');
  const { stdout, stderr } = await execFileAsync(process.execPath, args, {
    cwd: projectRoot,
    env: process.env,
    timeout: executePoc ? 180_000 : 60_000,
    maxBuffer: 1_000_000,
    windowsHide: true
  });
  return { stdout: stdout.slice(-8_000), stderr: stderr.slice(-8_000) };
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
    if (!state.eligible_for_proposal || !state.outbox_id) {
      return res.status(409).json({ error: 'This source is not eligible for a POC proposal.' });
    }
    const run = await runAnalyze(state.outbox_id, false);
    return res.json({ ...await loadWorkbench(req.auth.userId, req.params.postId), run });
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
    if (!state.eligible_for_proposal || !state.outbox_id) {
      return res.status(409).json({ error: 'This source is not eligible for POC execution.' });
    }
    const run = await runAnalyze(state.outbox_id, true);
    return res.json({ ...await loadWorkbench(req.auth.userId, req.params.postId), run });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
