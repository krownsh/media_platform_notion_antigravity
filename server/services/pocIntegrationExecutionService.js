import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateIntegrationTestPlan } from './pocIntegrationPlan.js';

const currentFile = fileURLToPath(import.meta.url);
const defaultSandboxRoot = path.resolve(path.dirname(currentFile), '../../sandbox');
const MAX_CAPTURE = 64 * 1024;

function assertRunId(runId) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(runId)) throw new Error('Invalid integration POC run id');
}

function appendBounded(current, chunk) {
  return `${current}${String(chunk)}`.slice(0, MAX_CAPTURE);
}

export async function prepareIntegrationWorkspace(planInput, options = {}) {
  const plan = validateIntegrationTestPlan(planInput);
  const runId = options.runId;
  assertRunId(runId);
  const sandboxRoot = path.resolve(options.sandboxRoot || defaultSandboxRoot);
  const runsRoot = path.resolve(sandboxRoot, 'runs');
  const runDirectory = path.resolve(runsRoot, runId);
  const relative = path.relative(runsRoot, runDirectory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Integration POC workspace escapes sandbox root');
  }
  await fs.mkdir(runsRoot, { recursive: true });
  await fs.mkdir(runDirectory, { recursive: false });
  await fs.writeFile(
    path.join(runDirectory, 'test-plan.json'),
    `${JSON.stringify(plan, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' }
  );
  return {
    runId,
    runDirectory,
    relativePlanPath: `runs/${runId}/test-plan.json`,
    plan
  };
}

export async function executeIntegrationWorkspace(workspace, options = {}) {
  const sandboxRoot = path.resolve(options.sandboxRoot || defaultSandboxRoot);
  const composeFile = path.resolve(sandboxRoot, 'docker-compose.yml');
  const spawnCommand = options.spawnCommand || spawn;
  const secretNames = workspace.plan.environment.required_secrets;
  const missingSecrets = secretNames.filter(name => !process.env[name]);
  if (missingSecrets.length) throw new Error(`Missing required POC secrets: ${missingSecrets.join(', ')}`);
  const args = [
    'compose', '-f', composeFile, 'run', '--rm', '--no-deps',
    ...secretNames.flatMap(name => ['-e', name]),
    'integration-runner'
  ];
  const started = Date.now();

  const processResult = await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawnCommand('docker', args, {
      cwd: sandboxRoot,
      env: {
        ...process.env,
        POC_INTEGRATION_RUN_DIR: workspace.runDirectory,
        POC_INTEGRATION_NETWORK_MODE: workspace.plan.environment.network_access ? 'bridge' : 'none'
      },
      shell: false,
      windowsHide: true
    });
    const timeoutMs = Math.min(
      Math.max(Number(options.timeoutMs) || workspace.plan.steps.reduce((sum, step) => sum + step.timeout_ms, 30_000), 5_000),
      30 * 60_000
    );
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout?.on('data', chunk => { stdout = appendBounded(stdout, chunk); });
    child.stderr?.on('data', chunk => { stderr = appendBounded(stderr, chunk); });
    child.once('error', error => {
      clearTimeout(timer);
      reject(new Error(`Failed to launch integration POC sandbox: ${error.message}`));
    });
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal: signal || null, stdout, stderr, timedOut });
    });
  });

  let evidence = null;
  try {
    evidence = JSON.parse(await fs.readFile(path.join(workspace.runDirectory, 'execution-evidence.json'), 'utf8'));
  } catch (error) {
    if (processResult.exitCode === 0) {
      throw new Error(`Integration runner did not produce valid evidence: ${error.message}`);
    }
  }
  return {
    success: processResult.exitCode === 0 && evidence?.status === 'success',
    status: processResult.timedOut ? 'timeout' : evidence?.status || 'error',
    exit_code: processResult.exitCode,
    signal: processResult.signal,
    stdout: processResult.stdout,
    stderr: processResult.stderr,
    duration_ms: Date.now() - started,
    evidence
  };
}
