import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { stageCodexPreprocessWorkflow } from '../../server/services/codexRemotePreprocessService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

async function main(workflowId, args) {
    const file = option(args, '--file');
    if (!file) throw new Error('--file <preprocess-result.json> is required');
    const raw = await readFile(path.resolve(file), 'utf8');
    if (Buffer.byteLength(raw) > 256 * 1024) throw new Error('Preprocess result must be 256 KB or smaller');
    return stageCodexPreprocessWorkflow({
        workflowId,
        agentId: option(args, '--agent') || 'codex:db-preprocess',
        result: JSON.parse(raw)
    });
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    main(args[0], args)
        .then(result => process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'CODEX_REMOTE_PREPROCESS_FAILED', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
