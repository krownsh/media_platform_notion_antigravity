import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { runPocWorkflow } from '../../server/services/pocService.js';
import {
    completeWorkflowAction,
    getWorkflowPost,
    loadWorkflow
} from '../../server/services/postWorkflowService.js';
import { getAcceptedTopicsForSource } from '../../server/services/topicGovernanceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function readOption(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

async function readCase(file) {
    if (!file) return null;
    const raw = await readFile(path.resolve(file), 'utf8');
    if (Buffer.byteLength(raw) > 32 * 1024) throw new Error('POC application case must be 32 KB or smaller');
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('POC application case must be a JSON object');
    }
    return value;
}

export async function runWorkflowPoc(workflowId, options = {}) {
    if (!options.agentIdentity) throw new Error('--agent <identity> is required');
    if (options.confirmation !== 'EXECUTE_POC') {
        throw new Error('Explicit --confirmation EXECUTE_POC is required to run a POC');
    }
    const { supabase } = await import('../../server/supabaseClient.js');
    const workflow = await loadWorkflow(workflowId, supabase);
    if (workflow.stage !== 'actions' || !['pending', 'failed'].includes(workflow.status)) {
        throw new Error(`Workflow ${workflow.id} is not ready for POC execution (${workflow.stage}/${workflow.status})`);
    }
    const action = (workflow.action_plan?.actions || []).find(item => item?.type === 'poc_execute');
    if (!action || !['approved', 'pending', 'failed', 'in_progress'].includes(action.status)) {
        throw new Error(`Workflow ${workflow.id} has no approved poc_execute action`);
    }
    const post = getWorkflowPost(workflow);
    if (!post) throw new Error('Workflow post was not found');
    const acceptedTopics = await getAcceptedTopicsForSource(post, supabase);
    if (acceptedTopics.length === 0) {
        throw new Error('POC execution requires an accepted match to an active user-owned topic');
    }
    const proposalAction = (workflow.action_plan?.actions || []).find(item => item?.type === 'poc_proposal');
    const testPlan = proposalAction?.outcome?.test_plan;
    if (!testPlan) {
        throw new Error('A completed poc_proposal with an approved test_plan is required before POC execution');
    }
    const applicationCase = await readCase(options.caseFile);
    try {
        const pocResult = await runPocWorkflow({
            postData: post,
            enrichedContext: options.enrichedContext || '',
            applicationCase,
            testPlan,
            acceptedTopics
        }, { supabaseClient: supabase });
        const completed = await completeWorkflowAction({
            workflowId,
            actionType: 'poc_execute',
            agentIdentity: options.agentIdentity,
            status: pocResult.status === 'success' ? 'completed' : 'failed',
            outcome: {
                run_id: pocResult.run_id,
                status: pocResult.status,
                stage: pocResult.stage,
                artifact_path: pocResult.artifact_path || null,
                execution: pocResult.execution || null,
                evidence: pocResult.evidence || null,
                claims_under_test: pocResult.claims_under_test || [],
                error: pocResult.error || null
            }
        }, supabase);
        if (pocResult.status !== 'success') {
            throw new Error(`POC execution finished with status: ${pocResult.status}`);
        }
        return {
            ok: true,
            workflow_id: completed.id,
            stage: completed.stage,
            status: completed.status,
            run_id: pocResult.run_id,
            poc_status: pocResult.status
        };
    } catch (error) {
        const storedResult = error.pocResult;
        if (storedResult) {
            try {
                await completeWorkflowAction({
                    workflowId,
                    actionType: 'poc_execute',
                    agentIdentity: options.agentIdentity,
                    status: 'failed',
                    outcome: {
                        run_id: storedResult.run_id,
                        status: storedResult.status,
                        stage: storedResult.stage,
                        error: storedResult.error || error.message
                    }
                }, supabase);
            } catch (persistError) {
                error.message = `${error.message}; failed to persist workflow action: ${persistError.message}`;
            }
        }
        throw error;
    }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const agentIndex = args.indexOf('--agent');
    runWorkflowPoc(args[0], {
        agentIdentity: agentIndex >= 0 ? args[agentIndex + 1] : null,
        confirmation: readOption(args, '--confirmation'),
        caseFile: readOption(args, '--case-file'),
        enrichedContext: readOption(args, '--context')
    })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
