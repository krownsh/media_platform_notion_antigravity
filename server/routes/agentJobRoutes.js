import express from 'express';
import { leaseNextJob, heartbeatJob, completeJob, failJob, createAgentJob } from '../services/agentJobService.js';
import { supabase } from '../supabaseClient.js';

export const agentJobRouter = express.Router();

/**
 * POST /api/agent/jobs/lease
 * Leases the next pending agent job for the authenticated user/runner.
 */
agentJobRouter.post('/lease', async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized user scope' });
  }

  const runnerIdentity = req.body?.runnerIdentity || 'local-runner-default';
  const jobTypes = req.body?.jobTypes || [];

  try {
    const job = await leaseNextJob(userId, runnerIdentity, jobTypes, 15, supabase);
    if (!job) {
      return res.status(200).json({ status: 'empty', message: 'No queued jobs available' });
    }
    return res.status(200).json({ status: 'leased', job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agent/jobs/:id/heartbeat
 */
agentJobRouter.post('/:id/heartbeat', async (req, res) => {
  const runnerIdentity = req.body?.runnerIdentity || 'local-runner-default';
  try {
    const updatedJob = await heartbeatJob(req.params.id, runnerIdentity, 15, supabase);
    return res.status(200).json({ status: 'active', job: updatedJob });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/agent/jobs/:id/complete
 */
agentJobRouter.post('/:id/complete', async (req, res) => {
  const runnerIdentity = req.body?.runnerIdentity || 'local-runner-default';
  const artifacts = req.body?.artifacts || [];

  try {
    const completed = await completeJob(req.params.id, runnerIdentity, artifacts, supabase);
    return res.status(200).json({ status: 'completed', job: completed });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/agent/jobs/:id/fail
 */
agentJobRouter.post('/:id/fail', async (req, res) => {
  const runnerIdentity = req.body?.runnerIdentity || 'local-runner-default';
  const errorTrace = req.body?.errorTrace || 'Unspecified failure';

  try {
    const failed = await failJob(req.params.id, runnerIdentity, errorTrace, supabase);
    return res.status(200).json({ status: 'failed', job: failed });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/agent/jobs
 * Manually enqueue a job (e.g. from Auditor or Matcher).
 */
agentJobRouter.post('/', async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized user scope' });
  }

  try {
    const created = await createAgentJob({ ...req.body, user_id: userId }, supabase);
    return res.status(201).json({ status: 'queued', job: created });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
