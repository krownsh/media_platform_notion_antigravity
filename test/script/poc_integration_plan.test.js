import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  evaluateIntegrationAssertions,
  PocTestPlanError,
  validateIntegrationTestPlan
} from '../../server/services/pocIntegrationPlan.js';
import {
  executeIntegrationWorkspace,
  prepareIntegrationWorkspace
} from '../../server/services/pocIntegrationExecutionService.js';

const sandboxRoot = path.resolve('sandbox');

function integrationPlan() {
  return {
    schema_version: 1,
    kind: 'integration',
    objective: 'Install and invoke the tool described by the captured post.',
    claims_under_test: ['The installed tool accepts a real request and returns an observable result.'],
    environment: { network_access: true, required_secrets: [] },
    steps: [
      {
        id: 'install',
        phase: 'setup',
        label: 'Install the package in the disposable workspace',
        argv: ['npm', '--version']
      },
      {
        id: 'request',
        phase: 'interaction',
        label: 'Send the planned request',
        argv: ['node', '-e', 'process.stdin.pipe(process.stdout)'],
        stdin: 'real request payload'
      },
      {
        id: 'observe',
        phase: 'observation',
        label: 'Inspect the produced result',
        argv: ['node', '-e', 'console.log("RESULT_OK")']
      }
    ],
    assertions: [
      {
        id: 'install-succeeded',
        description: 'The setup command exits successfully.',
        step_id: 'install',
        field: 'exit_code',
        operator: 'equals',
        expected: 0
      },
      {
        id: 'request-succeeded',
        description: 'The request command exits successfully.',
        step_id: 'request',
        field: 'exit_code',
        operator: 'equals',
        expected: 0
      },
      {
        id: 'result-observed',
        description: 'The independent observation reports the expected result.',
        step_id: 'observe',
        field: 'stdout',
        operator: 'contains',
        expected: 'RESULT_OK'
      }
    ],
    limitations: ['This test covers only the request in this plan.']
  };
}

test('integration POC plan requires claims, a real interaction and evidence assertions', () => {
  const plan = validateIntegrationTestPlan(integrationPlan());
  assert.equal(plan.steps[1].stdin, 'real request payload');
  assert.equal(plan.environment.network_access, true);

  assert.throws(() => validateIntegrationTestPlan({
    ...integrationPlan(),
    steps: integrationPlan().steps.filter(step => step.phase !== 'interaction')
  }), PocTestPlanError);
  assert.throws(() => validateIntegrationTestPlan({ ...integrationPlan(), assertions: [] }), PocTestPlanError);
  assert.throws(() => validateIntegrationTestPlan({
    ...integrationPlan(),
    steps: [{ ...integrationPlan().steps[0], phase: 'interaction', argv: ['bash', '-c', 'echo bypass'] }]
  }), /not allowed/);
});

test('integration verdict is based on captured response and observation, not an agent claim', () => {
  const plan = integrationPlan();
  const passed = evaluateIntegrationAssertions(plan, [
    { id: 'install', exit_code: 0, stdout: '10.0.0', stderr: '' },
    { id: 'request', exit_code: 0, stdout: 'agent says done', stderr: '' },
    { id: 'observe', exit_code: 0, stdout: 'RESULT_OK', stderr: '' }
  ]);
  assert.equal(passed.passed, true);

  const failed = evaluateIntegrationAssertions(plan, [
    { id: 'install', exit_code: 0, stdout: '10.0.0', stderr: '' },
    { id: 'request', exit_code: 0, stdout: 'agent says done', stderr: '' },
    { id: 'observe', exit_code: 0, stdout: 'missing result', stderr: '' }
  ]);
  assert.equal(failed.passed, false);
  assert.equal(failed.assertions[2].passed, false);
});

test('integration executor preserves plan, request, raw response, observations and assertions', async () => {
  const runId = `integration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const workspace = await prepareIntegrationWorkspace(integrationPlan(), { runId, sandboxRoot });
  const evidence = {
    schema_version: 1,
    kind: 'integration_evidence',
    status: 'success',
    steps: [],
    interactions: [{
      id: 'request',
      request: { argv: ['node'], stdin: 'real request payload' },
      stdout: 'raw tool response',
      stderr: '',
      exit_code: 0
    }],
    observations: [{ id: 'observe', stdout: 'RESULT_OK', exit_code: 0 }],
    assertions: [{ id: 'result-observed', passed: true }]
  };
  const fakeSpawn = (command, args, options) => {
    assert.equal(command, 'docker');
    assert.equal(options.shell, false);
    assert.match(options.env.POC_INTEGRATION_RUN_DIR, new RegExp(runId));
    assert.equal(options.env.POC_INTEGRATION_NETWORK_MODE, 'bridge');
    assert.ok(args.includes('integration-runner'));
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => true;
    queueMicrotask(async () => {
      await fs.writeFile(path.join(workspace.runDirectory, 'execution-evidence.json'), JSON.stringify(evidence));
      child.stdout.end(JSON.stringify(evidence));
      child.stderr.end();
      child.emit('close', 0, null);
    });
    return child;
  };

  try {
    const execution = await executeIntegrationWorkspace(workspace, { sandboxRoot, spawnCommand: fakeSpawn });
    assert.equal(execution.success, true);
    assert.equal(execution.evidence.interactions[0].request.stdin, 'real request payload');
    assert.equal(execution.evidence.interactions[0].stdout, 'raw tool response');
    assert.equal(execution.evidence.observations[0].stdout, 'RESULT_OK');
  } finally {
    await fs.rm(workspace.runDirectory, { recursive: true, force: true });
  }
});
