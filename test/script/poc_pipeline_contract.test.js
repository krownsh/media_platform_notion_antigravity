import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePocPlan } from '../../server/services/pocGenerator.js';
import { preparePocWorkspace } from '../../server/services/pocExecutionService.js';
import { createAgentJob, completeJob, leaseJobById } from '../../server/services/agentJobService.js';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');

const safeJavaScriptPlan = {
    language: 'javascript',
    objective: 'Verify a deterministic calculation.',
    success_criteria: ['stdout contains POC_OK'],
    limitations: ['Does not install or call an external package.'],
    code: "const result = 2 + 2;\nif (result !== 4) throw new Error('unexpected result');\nconsole.log('POC_OK');"
};

test('POC plans are constrained to fixed runtimes and no host capabilities', () => {
    const plan = validatePocPlan(safeJavaScriptPlan);
    assert.equal(plan.filename, 'main.js');
    assert.equal(plan.command, 'node main.js');

    assert.throws(() => validatePocPlan({
        ...safeJavaScriptPlan,
        code: "const { exec } = require('child_process'); exec('whoami');"
    }), /disallowed capability/);
});

test('POC workspace writes only under sandbox/jobs/<job-id>', async () => {
    const jobId = 'contract_poc_workspace';
    const workspace = await preparePocWorkspace(safeJavaScriptPlan, { jobId });
    try {
        assert.match(workspace.workspacePath, /sandbox[\\/]jobs[\\/]contract_poc_workspace$/);
        assert.equal(await fs.readFile(path.join(workspace.workspacePath, 'main.js'), 'utf8'), safeJavaScriptPlan.code);
        assert.equal(workspace.relativeScriptPath, 'contract_poc_workspace/main.js');
    } finally {
        await fs.rm(workspace.workspacePath, { recursive: true, force: true });
    }
});

test('POC jobs retain execution artifacts through the lease lifecycle', async () => {
    const userId = '00000000-0000-0000-0000-000000000099';
    const job = await createAgentJob({ user_id: userId, job_type: 'poc_execute' });
    const leased = await leaseJobById(userId, job.id, 'contract-runner');
    assert.equal(leased.status, 'leased');

    const completed = await completeJob(job.id, 'contract-runner', [{ type: 'poc_execution', execution: { status: 'passed' } }]);
    assert.equal(completed.status, 'completed');
    assert.equal(completed.result_artifacts[0].execution.status, 'passed');
});

test('sandbox runner has no dependency installation or network access', async () => {
    const runner = await fs.readFile(path.join(projectRoot, 'sandbox', 'runner.sh'), 'utf8');
    const compose = await fs.readFile(path.join(projectRoot, 'sandbox', 'docker-compose.yml'), 'utf8');
    assert.doesNotMatch(runner, /npm install/i);
    assert.match(compose, /network_mode: none/);
    assert.match(compose, /read_only: true/);
    assert.match(runner, /Invalid generated script path/);
});
