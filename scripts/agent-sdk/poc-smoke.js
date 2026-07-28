import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { executePocArtifact, writePocArtifact } from '../../server/services/pocService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sandboxRoot = path.resolve(__dirname, '../../sandbox');
const runsRoot = path.resolve(sandboxRoot, 'runs');

const smokeArtifacts = [
  {
    language: 'javascript',
    summary: 'Docker smoke test for the Node.js POC runner.',
    expected_output: 'NODE_POC_SMOKE_OK',
    success_criteria: ['Node.js assertion completes inside the isolated container.'],
    source_references: ['local-smoke-test'],
    code: 'import assert from "node:assert/strict";\nassert.equal(2 * 3, 6);\nconsole.log("NODE_POC_SMOKE_OK");'
  },
  {
    language: 'python',
    summary: 'Docker smoke test for the Python POC runner.',
    expected_output: 'PYTHON_POC_SMOKE_OK',
    success_criteria: ['Python assertion completes inside the isolated container.'],
    source_references: ['local-smoke-test'],
    code: 'result = 2 * 3\nassert result == 6\nprint("PYTHON_POC_SMOKE_OK")'
  }
];

function assertSafeRunDirectory(runDirectory) {
  const relative = path.relative(runsRoot, runDirectory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean unsafe smoke directory: ${runDirectory}`);
  }
}

async function main() {
  const createdDirectories = [];
  try {
    for (const [index, artifact] of smokeArtifacts.entries()) {
      const runId = `smoke-${Date.now()}-${index}`;
      const persisted = await writePocArtifact(artifact, { sandboxRoot, runId });
      createdDirectories.push(persisted.run_directory);

      const execution = await executePocArtifact(persisted, { sandboxRoot, timeoutMs: 25_000 });
      assert.equal(execution.success, true, execution.stderr || execution.stdout || execution.status);
      assert.match(execution.stdout, new RegExp(artifact.expected_output));
      console.log(`[POC Smoke] ${artifact.language}: ${execution.status} (${execution.duration_ms}ms)`);
    }
  } finally {
    for (const runDirectory of createdDirectories) {
      assertSafeRunDirectory(runDirectory);
      await fs.rm(runDirectory, { recursive: true, force: true });
    }
  }
}

main().catch(error => {
  console.error('[POC Smoke] Failed:', error.message);
  process.exitCode = 1;
});

