import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { evaluateIntegrationAssertions, validateIntegrationTestPlan } from '/opt/poc/pocIntegrationPlan.mjs';

const MAX_OUTPUT = 64 * 1024;
const workspace = '/workspace';

function bounded(value) {
  return String(value || '').slice(0, MAX_OUTPUT);
}

function redact(value, secrets) {
  let result = bounded(value);
  for (const secret of secrets) {
    if (secret) result = result.split(secret).join('[REDACTED]');
  }
  return result;
}

function runStep(step, secrets) {
  return new Promise(resolve => {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const cwd = step.cwd.startsWith('/') ? step.cwd : path.resolve(workspace, step.cwd);
    const child = spawn(step.argv[0], step.argv.slice(1), {
      cwd,
      env: process.env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, step.timeout_ms);
    child.stdout.on('data', chunk => { stdout = bounded(stdout + chunk); });
    child.stderr.on('data', chunk => { stderr = bounded(stderr + chunk); });
    child.on('error', error => { stderr = bounded(`${stderr}${error.message}`); });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        id: step.id,
        phase: step.phase,
        label: step.label,
        request: {
          argv: step.argv,
          cwd: step.cwd,
          stdin: redact(step.stdin, secrets)
        },
        exit_code: exitCode,
        signal: signal || null,
        timed_out: timedOut,
        stdout: redact(stdout, secrets),
        stderr: redact(stderr, secrets),
        started_at: startedAt,
        duration_ms: Date.now() - started
      });
    });
    if (step.stdin) child.stdin.end(step.stdin);
    else child.stdin.end();
  });
}

async function main() {
  const plan = validateIntegrationTestPlan(JSON.parse(await fs.readFile('/workspace/test-plan.json', 'utf8')));
  const missingSecrets = plan.environment.required_secrets.filter(name => !process.env[name]);
  if (missingSecrets.length) throw new Error(`Missing required secrets: ${missingSecrets.join(', ')}`);
  const secretValues = plan.environment.required_secrets.map(name => process.env[name]).filter(Boolean);
  const steps = [];
  for (const step of plan.steps) steps.push(await runStep(step, secretValues));
  const verdict = evaluateIntegrationAssertions(plan, steps);
  const evidence = {
    schema_version: 1,
    kind: 'integration_evidence',
    objective: plan.objective,
    claims_under_test: plan.claims_under_test,
    status: verdict.passed ? 'success' : 'failed',
    environment: {
      network_access: plan.environment.network_access,
      required_secret_names: plan.environment.required_secrets
    },
    steps,
    interactions: steps.filter(step => step.phase === 'interaction'),
    observations: steps.filter(step => step.phase === 'observation'),
    assertions: verdict.assertions,
    limitations: plan.limitations,
    completed_at: new Date().toISOString()
  };
  await fs.writeFile('/workspace/execution-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
  process.exitCode = verdict.passed ? 0 : 1;
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify({ status: 'error', error: error.message })}\n`);
  process.exitCode = 2;
});
