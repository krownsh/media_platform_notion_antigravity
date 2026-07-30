import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validatePocPlan } from './pocGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sandboxRoot = path.resolve(__dirname, '../../sandbox');
const jobsRoot = path.join(sandboxRoot, 'jobs');
const runnerPath = path.join(sandboxRoot, 'runner.sh');
const MAX_OUTPUT_LENGTH = 64 * 1024;

function safeJobId(value) {
    const candidate = String(value || randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!candidate || candidate.length > 120) throw new Error('Invalid POC job id');
    return candidate;
}

function appendBounded(current, chunk) {
    if (current.length >= MAX_OUTPUT_LENGTH) return current;
    return (current + chunk).slice(0, MAX_OUTPUT_LENGTH);
}

export async function preparePocWorkspace(rawPlan, options = {}) {
    const plan = validatePocPlan(rawPlan);
    const jobId = safeJobId(options.jobId);
    const workspacePath = path.resolve(jobsRoot, jobId);
    if (!workspacePath.startsWith(`${jobsRoot}${path.sep}`)) throw new Error('POC workspace escapes sandbox root');

    await fs.mkdir(workspacePath, { recursive: true, mode: 0o755 });
    await fs.writeFile(path.join(workspacePath, plan.filename), plan.code, { encoding: 'utf8', mode: 0o644 });
    await fs.writeFile(path.join(workspacePath, 'manifest.json'), JSON.stringify({
        job_id: jobId,
        language: plan.language,
        filename: plan.filename,
        command: plan.command,
        objective: plan.objective,
        success_criteria: plan.success_criteria,
        limitations: plan.limitations,
        created_at: new Date().toISOString()
    }, null, 2), { encoding: 'utf8', mode: 0o644 });

    return { jobId, workspacePath, relativeScriptPath: `${jobId}/${plan.filename}`, plan };
}

export async function runPocWorkspace(workspace, options = {}) {
    const timeoutMs = Math.min(Math.max(Number(options.timeoutMs) || 45_000, 1_000), 120_000);
    const startedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
        const child = spawn('bash', [runnerPath, workspace.plan.language, workspace.relativeScriptPath], {
            cwd: sandboxRoot,
            env: { PATH: process.env.PATH },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
        }, timeoutMs);

        child.stdout.on('data', (chunk) => { stdout = appendBounded(stdout, chunk.toString()); });
        child.stderr.on('data', (chunk) => { stderr = appendBounded(stderr, chunk.toString()); });
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.on('close', (exitCode, signal) => {
            clearTimeout(timer);
            resolve({
                status: !timedOut && exitCode === 0 ? 'passed' : 'failed',
                exit_code: exitCode,
                signal,
                timed_out: timedOut,
                stdout,
                stderr,
                started_at: startedAt,
                finished_at: new Date().toISOString(),
                timeout_ms: timeoutMs
            });
        });
    });
}

export async function executePocPlan(rawPlan, options = {}) {
    const workspace = await preparePocWorkspace(rawPlan, options);
    const execution = await runPocWorkspace(workspace, options);
    return {
        type: 'poc_execution',
        workspace: { job_id: workspace.jobId, script: workspace.relativeScriptPath },
        plan: workspace.plan,
        execution
    };
}
