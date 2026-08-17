import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const skill = fs.readFileSync(path.join(projectRoot, 'hermes/skills/my-mediacrawl-skill/SKILL.md'), 'utf8');
const docs = fs.readFileSync(path.join(projectRoot, 'docs/hermes_outbox_workflow.md'), 'utf8');
const preprocess = fs.readFileSync(path.join(projectRoot, 'scripts/agent-sdk/preprocess-workflow.js'), 'utf8');
const vaultSync = fs.readFileSync(path.join(projectRoot, 'scripts/agent-sdk/vault-sync-workflow.js'), 'utf8');
const vaultDrain = fs.readFileSync(path.join(projectRoot, 'scripts/agent-sdk/drain-vault-sync.js'), 'utf8');
const remotePreprocess = fs.readFileSync(path.join(projectRoot, 'server/services/codexRemotePreprocessService.js'), 'utf8');
const remoteMigration = fs.readFileSync(path.join(projectRoot, 'database/deployments/stage_m_codex_remote_preprocess.sql'), 'utf8');
const knowledge = fs.readFileSync(path.join(projectRoot, 'server/services/autonomousKnowledgeService.js'), 'utf8');
const triage = fs.readFileSync(path.join(projectRoot, 'scripts/agent-sdk/triage-workflow.js'), 'utf8');

test('five-minute Cron is unattended and persists deferred work', () => {
    assert.match(skill, /must never ask the user a question during that\s+run/i);
    assert.match(skill, /move the workflow to\s+`research\/pending`/i);
    assert.match(skill, /write `context\.review_request`/i);
    assert.match(skill, /Normal Cron output is `\[SILENT\]`/i);
    assert.match(docs, /agent:preprocess owns lease release/i);
});

test('preprocess command writes Vault before releasing the workflow', () => {
    assert.match(preprocess, /writeWorkflowVaultNotes/);
    assert.match(preprocess, /transitionWorkflow/);
    assert.match(preprocess, /releaseHermesCronWorkflow/);
    assert.match(preprocess, /review.*awaiting_user/s);
    assert.match(preprocess, /research.*pending/s);
});

test('remote DB-only preprocessing defers the real Vault write', () => {
    assert.match(preprocess, /deferVault/);
    assert.match(preprocess, /stage: 'vault_sync'/);
    assert.match(preprocess, /vault_sync: \{/);
    assert.match(preprocess, /note_input: noteInput/);
    assert.match(preprocess, /deferredVaultActionPlan/);
});

test('Vault sync finalizes the recorded target only after a real note write', () => {
    assert.match(vaultSync, /writeWorkflowVaultNotes/);
    assert.match(vaultSync, /target_stage/);
    assert.match(vaultSync, /target_status/);
    assert.match(vaultSync, /stage: sync\.target_stage/);
    assert.match(vaultSync, /status: sync\.target_status/);
    assert.match(vaultSync, /vault_sync.*completed/s);
});

test('Vault backlog drain is a one-shot loop, not a resident worker', () => {
    assert.match(vaultDrain, /queue: 'vault_sync'/);
    assert.match(vaultDrain, /stopped_when_empty/);
    assert.match(vaultDrain, /maxItems/);
    assert.match(vaultDrain, /syncVaultWorkflow/);
});

test('Codex can persist DB-only preprocessing without pretending to write Vault', () => {
    assert.match(remotePreprocess, /codex_stage_collection_preprocess/);
    assert.match(remotePreprocess, /normalizePreprocessInput/);
    assert.match(remoteMigration, /security definer/);
    assert.match(remoteMigration, /stage = 'vault_sync'/);
    assert.match(remoteMigration, /exact_duplicate_id/);
    assert.match(remoteMigration, /network\/Secrets POC boundary|network\/Secrets POC/i);
    assert.match(remoteMigration, /grant execute .*service_role/s);
});

test('duplicate sources inherit an existing collection when one is known', () => {
    assert.match(knowledge, /collection_id/);
    assert.match(knowledge, /Duplicate collection inheritance failed/);
    assert.match(knowledge, /Related collection lookup failed/);
    assert.match(preprocess, /duplicate: persistence\.exact_duplicate/);
    assert.match(preprocess, /inherited_from_duplicate/);
});

test('legacy Cron triage cannot create an interactive strategy pause', () => {
    assert.match(triage, /stage: isCronRun \? 'preprocessing' : 'strategy'/);
    assert.match(triage, /status: isCronRun \? 'pending' : 'awaiting_user'/);
});
