/**
 * Agent Job Control Plane Service
 * Manages job queue, atomic leases, heartbeats, and completion results for Local Agent Runners.
 */

// In-memory job repository for standalone local node tests / fallback
const inMemoryJobs = new Map();

/**
 * Creates a new Agent Job.
 */
export async function createAgentJob(jobData, supabaseClient = null) {
  if (!jobData || !jobData.user_id || !jobData.job_type) {
    throw new Error('user_id and job_type are required to create an Agent Job');
  }

  const job = {
    id: jobData.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    user_id: jobData.user_id,
    job_type: jobData.job_type,
    project_id: jobData.project_id || null,
    source_id: jobData.source_id || null,
    application_case_id: jobData.application_case_id || null,
    status: 'queued',
    priority: jobData.priority || 50,
    intent_capsule: jobData.intent_capsule || {},
    allowed_paths: jobData.allowed_paths || [],
    allowed_commands: jobData.allowed_commands || [],
    lease_owner: null,
    lease_expires_at: null,
    attempts: 0,
    max_attempts: jobData.max_attempts || 3,
    correlation_id: jobData.correlation_id || null,
    result_artifacts: [],
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('agent_jobs')
      .insert(job)
      .select()
      .single();
    if (error) throw new Error(`Supabase error creating agent_job: ${error.message}`);
    return data;
  }

  inMemoryJobs.set(job.id, job);
  return job;
}

/**
 * Atomically leases the next highest priority queued job for a runner.
 */
export async function leaseNextJob(userId, runnerIdentity, jobTypes = [], leaseDurationMinutes = 15, supabaseClient = null) {
  if (!userId || !runnerIdentity) {
    throw new Error('userId and runnerIdentity are required to lease an Agent Job');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseDurationMinutes * 60 * 1000).toISOString();

  if (supabaseClient) {
    // DB RPC or atomic update
    const { data: candidates, error } = await supabaseClient
      .from('agent_jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'queued')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) throw new Error(`Error fetching queued jobs: ${error.message}`);
    if (!candidates || candidates.length === 0) return null;

    const targetJob = candidates[0];
    const { data: leased, error: leaseErr } = await supabaseClient
      .from('agent_jobs')
      .update({
        status: 'leased',
        lease_owner: runnerIdentity,
        lease_expires_at: expiresAt,
        attempts: targetJob.attempts + 1,
        updated_at: now.toISOString()
      })
      .eq('id', targetJob.id)
      .eq('status', 'queued')
      .select()
      .single();

    if (leaseErr) return null; // Race condition caught
    return leased;
  }

  // Fallback in-memory lease logic
  for (const job of inMemoryJobs.values()) {
    if (job.user_id === userId && job.status === 'queued') {
      if (jobTypes.length > 0 && !jobTypes.includes(job.job_type)) continue;
      
      job.status = 'leased';
      job.lease_owner = runnerIdentity;
      job.lease_expires_at = expiresAt;
      job.attempts += 1;
      job.updated_at = now.toISOString();
      return job;
    }
  }

  return null;
}

/**
 * Extends the lease timer for an active job.
 */
export async function heartbeatJob(jobId, runnerIdentity, leaseDurationMinutes = 15, supabaseClient = null) {
  const expiresAt = new Date(Date.now() + leaseDurationMinutes * 60 * 1000).toISOString();

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('agent_jobs')
      .update({ lease_expires_at: expiresAt, status: 'running', updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('lease_owner', runnerIdentity)
      .select()
      .single();

    if (error) throw new Error(`Heartbeat failed: ${error.message}`);
    return data;
  }

  const job = inMemoryJobs.get(jobId);
  if (job && job.lease_owner === runnerIdentity) {
    job.lease_expires_at = expiresAt;
    job.status = 'running';
    job.updated_at = new Date().toISOString();
    return job;
  }

  throw new Error(`Job ${jobId} not found or lease owner mismatch`);
}

/**
 * Completes a leased agent job.
 */
export async function completeJob(jobId, runnerIdentity, artifacts = [], supabaseClient = null) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('agent_jobs')
      .update({
        status: 'completed',
        result_artifacts: artifacts,
        lease_owner: null,
        lease_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('lease_owner', runnerIdentity)
      .select()
      .single();

    if (error) throw new Error(`Complete job failed: ${error.message}`);
    return data;
  }

  const job = inMemoryJobs.get(jobId);
  if (job && job.lease_owner === runnerIdentity) {
    job.status = 'completed';
    job.result_artifacts = artifacts;
    job.lease_owner = null;
    job.lease_expires_at = null;
    job.updated_at = new Date().toISOString();
    return job;
  }

  throw new Error(`Job ${jobId} not found or lease owner mismatch`);
}

/**
 * Fails a leased agent job.
 */
export async function failJob(jobId, runnerIdentity, errorTrace, supabaseClient = null) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('agent_jobs')
      .update({
        status: 'failed',
        last_error: String(errorTrace),
        lease_owner: null,
        lease_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .eq('lease_owner', runnerIdentity)
      .select()
      .single();

    if (error) throw new Error(`Fail job failed: ${error.message}`);
    return data;
  }

  const job = inMemoryJobs.get(jobId);
  if (job && job.lease_owner === runnerIdentity) {
    job.status = 'failed';
    job.last_error = String(errorTrace);
    job.lease_owner = null;
    job.lease_expires_at = null;
    job.updated_at = new Date().toISOString();
    return job;
  }

  throw new Error(`Job ${jobId} not found or lease owner mismatch`);
}
