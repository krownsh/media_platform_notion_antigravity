import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { classifyRoutesByRules } from '../../server/services/routeAgent.js';
import {
    claimWorkflow,
    getWorkflowPost,
    loadWorkflow,
    transitionWorkflow
} from '../../server/services/postWorkflowService.js';
import {
    claimHermesOutboxItem,
    completeHermesTriage,
    failHermesOutboxItem
} from '../../server/services/hermesOutboxService.js';
import { finishHermesAgentRun } from '../../server/services/hermesDispatchService.js';
import { dispatchNext } from './dispatch-next.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function analysisFor(post) {
    return Array.isArray(post?.collection_post_analysis)
        ? post.collection_post_analysis[0]
        : post?.collection_post_analysis;
}

function buildTriageContext(workflow, post, classification) {
    const analysis = analysisFor(post);
    return {
        ...(workflow.context && typeof workflow.context === 'object' ? workflow.context : {}),
        triage: {
            status: 'completed',
            completed_at: new Date().toISOString(),
            primary_category: analysis?.primary_category || 'other',
            summary: analysis?.summary || null,
            tags: Array.isArray(analysis?.tags) ? analysis.tags.slice(0, 10) : [],
            topics: Array.isArray(analysis?.topics) ? analysis.topics.slice(0, 10) : [],
            route_candidates: classification.routes,
            reasons: classification.reasons,
            next_step: 'Discuss the source with the user and persist an explicit per-post action plan.'
        }
    };
}

export async function triageWorkflow(workflowId, options = {}) {
    const agentIdentity = options.agentIdentity;
    if (!agentIdentity) throw new Error('--agent <identity> is required');
    const { supabase } = await import('../../server/supabaseClient.js');
    let workflow = await loadWorkflow(workflowId, supabase);
    if (workflow.stage !== 'triage' || !['pending', 'failed'].includes(workflow.status)) {
        throw new Error(`Workflow ${workflow.id} is not ready for triage (${workflow.stage}/${workflow.status})`);
    }

    let outboxEvent = null;
    let claimedWorkflow = null;
    try {
        if (workflow.outbox_event_id) {
            const { data: outbox, error } = await supabase
                .from('collection_capture_outbox')
                .select('id, status')
                .eq('id', workflow.outbox_event_id)
                .maybeSingle();
            if (error) throw new Error(`Outbox lookup failed: ${error.message}`);
            if (outbox?.status === 'pending') {
                outboxEvent = await claimHermesOutboxItem(outbox.id, agentIdentity, supabase);
            }
        }

        claimedWorkflow = await claimWorkflow(workflow, agentIdentity, supabase);
        const post = getWorkflowPost(claimedWorkflow);
        if (!post) throw new Error('Workflow post was not found');
        const classification = classifyRoutesByRules(post);
        const transitioned = await transitionWorkflow({
            workflow: claimedWorkflow,
            agentIdentity,
            stage: 'strategy',
            status: 'awaiting_user',
            context: buildTriageContext(claimedWorkflow, post, classification)
        }, supabase);

        if (outboxEvent) {
            await completeHermesTriage(outboxEvent, agentIdentity, supabase, { workflowId: transitioned.id });
        }

        if (options.dispatchId) {
            await finishHermesAgentRun({
                dispatchId: options.dispatchId,
                agentId: agentIdentity,
                status: 'awaiting_user'
            }, supabase);
            try {
                await dispatchNext({ workerId: `hermes:completion:${options.dispatchId}` });
            } catch (dispatchError) {
                // The Agent slot is already released. A later Hermes Cron/manual
                // wake can retry the next pending dispatch without reopening this one.
                console.error(`[Workflow Triage] Next Hermes wake failed: ${dispatchError.message}`);
            }
        }

        return {
            ok: true,
            workflow_id: transitioned.id,
            stage: transitioned.stage,
            status: transitioned.status,
            post: {
                id: post.id,
                title: post.title,
                url: post.platform === 'image' ? null : post.original_url,
                platform: post.platform,
                summary: analysisFor(post)?.summary || null,
                primary_category: analysisFor(post)?.primary_category || 'other'
            },
            route_candidates: classification.routes
        };
    } catch (error) {
        if (claimedWorkflow?.locked_by === agentIdentity) {
            try {
                await transitionWorkflow({
                    workflow: claimedWorkflow,
                    agentIdentity,
                    stage: 'triage',
                    status: 'failed',
                    failedStage: 'triage',
                    lastError: error.message
                }, supabase);
            } catch (transitionError) {
                console.error(`[Workflow Triage] Failed to persist workflow error: ${transitionError.message}`);
            }
        }
        if (options.dispatchId) {
            try {
                await finishHermesAgentRun({
                    dispatchId: options.dispatchId,
                    agentId: agentIdentity,
                    status: 'failed',
                    errorMessage: error.message
                }, supabase);
            } catch (finishError) {
                console.error(`[Workflow Triage] Failed to release Hermes agent slot: ${finishError.message}`);
            }
        }
        if (outboxEvent?.locked_by === agentIdentity) {
            try {
                await failHermesOutboxItem(outboxEvent, agentIdentity, 'triage', error, supabase);
            } catch (outboxError) {
                console.error(`[Workflow Triage] Failed to persist outbox error: ${outboxError.message}`);
            }
        }
        throw error;
    }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    const agentIndex = args.indexOf('--agent');
    const dispatchIndex = args.indexOf('--dispatch');
    triageWorkflow(args[0], {
        agentIdentity: agentIndex >= 0 ? args[agentIndex + 1] : null,
        dispatchId: dispatchIndex >= 0 ? args[dispatchIndex + 1] : null
    })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
