import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
    completeWorkflowAction,
    getWorkflowPost,
    loadWorkflow
} from '../../server/services/postWorkflowService.js';
import {
    assertNoteInputSize,
    writeWorkflowVaultNotes
} from '../../server/services/vaultNoteService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function readOption(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

async function readNoteInput(file) {
    if (!file) return {};
    const raw = await readFile(path.resolve(file), 'utf8');
    assertNoteInputSize(raw);
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Vault note input must be a JSON object');
    }
    return value;
}

export async function writeVaultNote(workflowId, options = {}) {
    if (!options.agentIdentity) throw new Error('--agent <identity> is required');
    const { supabase } = await import('../../server/supabaseClient.js');
    const workflow = await loadWorkflow(workflowId, supabase);
    if (workflow.stage !== 'actions' || !['pending', 'failed'].includes(workflow.status)) {
        throw new Error(`Workflow ${workflow.id} is not ready for a Vault note (${workflow.stage}/${workflow.status})`);
    }
    const vaultAction = (workflow.action_plan?.actions || []).find(action => action?.type === 'vault_note');
    if (!vaultAction) throw new Error(`Workflow ${workflow.id} has no mandatory vault_note action`);
    if (['completed', 'skipped'].includes(vaultAction.status)) {
        return {
            ok: true,
            already_completed: true,
            workflow_id: workflow.id,
            stage: workflow.stage,
            status: workflow.status,
            outcome: vaultAction.outcome || null
        };
    }

    const noteInput = await readNoteInput(options.file);
    const outcome = await writeWorkflowVaultNotes({
        workflow,
        noteInput,
        vaultRoot: options.vaultRoot
    });
    const completed = await completeWorkflowAction({
        workflowId,
        actionType: 'vault_note',
        agentIdentity: options.agentIdentity,
        status: 'completed',
        outcome
    }, supabase);
    return {
        ok: true,
        workflow_id: completed.id,
        stage: completed.stage,
        status: completed.status,
        relative_path: outcome.relative_path,
        replication_path: outcome.replication_path,
        post_id: getWorkflowPost(completed)?.id || outcome.post_id
    };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const agentIndex = args.indexOf('--agent');
    writeVaultNote(args[0], {
        agentIdentity: agentIndex >= 0 ? args[agentIndex + 1] : null,
        file: readOption(args, '--file'),
        vaultRoot: readOption(args, '--vault')
    })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
