import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';

import { classifyRoutesByRules, classifyPostRoutes } from '../../server/services/routeAgent.js';
import { auditProjectDirectory } from '../../server/services/projectAuditor.js';
import { matchSourceToProjectNeeds } from '../../server/services/opportunityMatcher.js';
import { createAgentJob, leaseNextJob, heartbeatJob, completeJob, failJob } from '../../server/services/agentJobService.js';
import { createFastTrackDraft } from '../../server/services/contentStudioService.js';

test('Route Agent - Rule Classification', () => {
  const toolPost = {
    title: 'Awesome GitHub Repo for LLM Caching',
    content: 'Check out this new npm package for fast prompt caching: github.com/test/repo with pip install support.',
    platform: 'generic',
    source_domains: ['github.com']
  };

  const result = classifyRoutesByRules(toolPost);
  assert.equal(result.primary_intent, 'apply_poc');
  assert.equal(result.urgency, 'high');
  assert.ok(result.routes.some(r => r.type === 'apply_poc'));
  assert.ok(result.routes.some(r => r.type === 'quick_rewrite'));
});

test('Project Auditor - Local Directory Dry-Run Scan', async () => {
  const workspaceRoot = path.resolve('.');
  const { snapshot, needs } = await auditProjectDirectory(workspaceRoot, { maxDepth: 2 });

  assert.ok(snapshot.fileCount > 0);
  assert.ok(snapshot.projectName);
  assert.ok(Array.isArray(needs));
});

test('Opportunity Matcher - Bi-directional Matching', () => {
  const routeClassification = {
    primary_intent: 'apply_poc',
    routes: [{ type: 'apply_poc', priority: 85 }]
  };

  const postData = {
    title: 'New Puppeteer Stealth Crawler Plugin',
    content: 'Solve crawler captcha and stealth parsing for threads and instagram.',
    original_url: 'https://github.com/stealth/crawler'
  };

  const projectNeeds = [
    {
      id: 'need_1',
      title: 'Crawler adapter captcha failure',
      category: 'missing_feature',
      severity: 'high',
      impact: 'Crawler fails on anti-bot protection',
      evidence: [{ location: 'server/services/crawlerService/' }]
    }
  ];

  const matches = matchSourceToProjectNeeds(routeClassification, postData, projectNeeds, { id: 'proj_1' });
  assert.ok(matches.length > 0);
  assert.equal(matches[0].project_need_id, 'need_1');
  assert.ok(matches[0].score >= 40);
});

test('Agent Job Control Plane - In-Memory Lifecycle', async () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  const createdJob = await createAgentJob({
    user_id: userId,
    job_type: 'poc_execute',
    priority: 90,
    intent_capsule: { candidate_module: 'test/poc/' }
  });

  assert.equal(createdJob.status, 'queued');

  // Lease job
  const leasedJob = await leaseNextJob(userId, 'runner_node_1');
  assert.ok(leasedJob);
  assert.equal(leasedJob.id, createdJob.id);
  assert.equal(leasedJob.status, 'leased');
  assert.equal(leasedJob.lease_owner, 'runner_node_1');

  // Heartbeat
  const activeJob = await heartbeatJob(createdJob.id, 'runner_node_1');
  assert.equal(activeJob.status, 'running');

  // Complete
  const completedJob = await completeJob(createdJob.id, 'runner_node_1', [{ type: 'log', uri: 'test.log' }]);
  assert.equal(completedJob.status, 'completed');
  assert.equal(completedJob.result_artifacts.length, 1);
});

test('Content Studio - Fast-Track Draft Adaptation', async () => {
  const postData = {
    title: 'AI Agent Architecture 2026',
    content: 'Building autonomous agent pipelines with structured event outbox and transactional state.',
    original_url: 'https://example.com/agent-arch'
  };

  const draft = await createFastTrackDraft(postData, 'x_thread');
  assert.ok(draft.title);
  assert.equal(draft.format, 'x_thread');
  assert.ok(draft.body.includes('https://example.com/agent-arch') || draft.metadata.attribution);
});
