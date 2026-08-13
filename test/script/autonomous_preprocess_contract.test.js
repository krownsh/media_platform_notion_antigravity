import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const skill = fs.readFileSync(path.join(projectRoot, 'hermes/skills/my-mediacrawl-skill/SKILL.md'), 'utf8');
const docs = fs.readFileSync(path.join(projectRoot, 'docs/hermes_outbox_workflow.md'), 'utf8');
const preprocess = fs.readFileSync(path.join(projectRoot, 'scripts/agent-sdk/preprocess-workflow.js'), 'utf8');
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
