import express from 'express';
import { supabase } from '../supabaseClient.js';
import { normalizeParallelTracks, withParallelTrack } from '../services/parallelTrackService.js';

export const parallelTrackRouter = express.Router();

async function loadOwnedWorkflow(userId, postId) {
  const { data: post, error } = await supabase
    .from('collection_posts')
    .select('id, collection_post_workflows(*)')
    .eq('id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!post) return null;
  const workflow = Array.isArray(post.collection_post_workflows)
    ? post.collection_post_workflows[0]
    : post.collection_post_workflows;
  return workflow || null;
}

parallelTrackRouter.patch('/:postId/:trackKey', async (req, res) => {
  try {
    const workflow = await loadOwnedWorkflow(req.auth.userId, req.params.postId);
    if (!workflow) return res.status(404).json({ error: 'Post workflow not found' });

    const context = withParallelTrack(workflow.context, req.params.trackKey, {
      status: req.body?.status,
      reason: req.body?.reason
    });
    const { data, error } = await supabase
      .from('collection_post_workflows')
      .update({ context })
      .eq('id', workflow.id)
      .eq('updated_at', workflow.updated_at)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'Workflow changed; refresh and retry' });

    return res.json({
      workflow: data,
      parallelTracks: normalizeParallelTracks(data.context)
    });
  } catch (error) {
    if (/^Unsupported parallel track/.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[Parallel tracks] update failed:', error.message);
    return res.status(500).json({ error: 'Unable to update parallel track' });
  }
});
