import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadWorkflow } from '../../server/services/postWorkflowService.js';
import { formatWorkflow } from './next-workflow.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
dotenv.config({ path: path.resolve(currentDirectory, '../../server/.env'), quiet: true });

export async function getWorkflowById(workflowId) {
    const id = String(workflowId || '').trim();
    if (!id) throw new Error('workflow id is required');
    const { supabase } = await import('../../server/supabaseClient.js');
    return { ok: true, workflow: formatWorkflow(await loadWorkflow(id, supabase)) };
}

const isMainModule = process.argv[1]
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    getWorkflowById(process.argv[2])
        .then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
