import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizePlan } from '../../scripts/agent-sdk/decide-workflow.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const deployment = fs.readFileSync(path.join(projectRoot, 'database', 'deployments', 'stage_g_post_workflow.sql'), 'utf8');
const workflowService = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'postWorkflowService.js'), 'utf8');
const decisionCli = fs.readFileSync(path.join(projectRoot, 'scripts', 'agent-sdk', 'decide-workflow.js'), 'utf8');
const pocCli = fs.readFileSync(path.join(projectRoot, 'scripts', 'agent-sdk', 'run-poc-workflow.js'), 'utf8');
const workbenchRoute = fs.readFileSync(path.join(projectRoot, 'server', 'routes', 'pocWorkbenchRoutes.js'), 'utf8');
const skill = fs.readFileSync(path.join(projectRoot, 'hermes', 'skills', 'my-mediacrawl-skill', 'SKILL.md'), 'utf8');

test('post workflow separates user-facing lifecycle from technical outbox delivery', () => {
  assert.match(deployment, /create table if not exists public\.collection_post_workflows/);
  assert.match(deployment, /stage text not null check \(stage in \('base_analysis', 'triage', 'strategy', 'actions', 'complete'\)\)/);
  assert.match(deployment, /status text not null check \(status in \('pending', 'processing', 'awaiting_user', 'completed', 'failed', 'blocked'\)\)/);
  assert.match(deployment, /alter table public\.collection_post_workflows enable row level security/);
  assert.match(deployment, /revoke all on table public\.collection_post_workflows from public, anon, authenticated/);
  assert.match(deployment, /initialize_collection_post_workflow/);
  assert.match(workflowService, /retry_failed/);
  assert.match(skill, /`sent` means Hermes consumed the delivery event/);
  assert.match(deployment, /Legacy `sent` only proves that the old technical delivery completed/);
  assert.doesNotMatch(deployment, /when outbox\.status = 'sent' then 'completed'/);
});

test('rewrite is an explicit output action rather than an automatic triage route', () => {
  assert.match(skill, /Rewrite is an output stage, not a default triage route/);
  assert.match(skill, /fast_rewrite/);
  assert.match(skill, /content_synthesis/);
  assert.match(decisionCli, /poc_execute.*fast_rewrite.*content_synthesis/s);
});

test('POC execution is explicit and synchronous; no hidden worker is referenced', () => {
  assert.match(decisionCli, /replication_plan/);
  assert.match(decisionCli, /vault_note/);
  assert.match(pocCli, /EXECUTE_POC/);
  assert.match(pocCli, /runPocWorkflow/);
  assert.doesNotMatch(pocCli, /node-tool-verifier|cron worker|poc worker/i);
  assert.match(workbenchRoute, /POC proposals are created during Hermes strategy discussion/);
  assert.match(workbenchRoute, /runWorkflowPoc/);
});

test('every strategy decision receives a final vault_note action', () => {
  const plan = normalizePlan({ actions: [] }, 'hermes:test');
  assert.deepEqual(plan.actions.map(action => action.type), ['vault_note']);
  assert.equal(plan.actions.at(-1).status, 'approved');
});
