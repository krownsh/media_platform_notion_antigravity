import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { normalizeAutonomyDecision } from '../../server/services/autonomyPolicyService.js';
import { getWorkflowPost, loadWorkflow, transitionWorkflow } from '../../server/services/postWorkflowService.js';
import { releaseHermesCronWorkflow } from '../../server/services/hermesCronService.js';
import { writeWorkflowVaultNotes } from '../../server/services/vaultNoteService.js';
import { getAcceptedTopicsForSource } from '../../server/services/topicGovernanceService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

function text(value, max = 20_000) {
    return String(value ?? '').replace(/\0/g, '').slice(0, max).trim();
}

async function readResearch(file) {
    if (!file) throw new Error('--file <research-result.json> is required');
    const raw = await readFile(path.resolve(file), 'utf8');
    if (Buffer.byteLength(raw) > 256 * 1024) throw new Error('Research result must be 256 KB or smaller');
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Research result must be a JSON object');
    return value;
}

function actionPlan(vaultOutcome) {
    return {
        schema_version: 2,
        actions: [{
            type: 'vault_note',
            status: 'completed',
            requested_by: 'hermes:research',
            requested_at: new Date().toISOString(),
            completed_by: 'hermes:research',
            completed_at: new Date().toISOString(),
            outcome: vaultOutcome
        }]
    };
}

export async function researchWorkflow(workflowId, options = {}) {
    if (!options.agentIdentity) throw new Error('--agent <identity> is required');
    const { supabase } = await import('../../server/supabaseClient.js');
    const workflow = await loadWorkflow(workflowId, supabase);
    if (workflow.stage !== 'research' || workflow.status !== 'processing' || workflow.locked_by !== options.agentIdentity) {
        throw new Error(`Workflow ${workflow.id} is not leased for research`);
    }
    try {
        const result = await readResearch(options.file);
        const post = getWorkflowPost(workflow);
        if (!post) throw new Error(`Workflow ${workflow.id} has no source post`);
        const acceptedTopics = await getAcceptedTopicsForSource(post, supabase);
        if (acceptedTopics.length === 0) {
            throw new Error('Research requires an accepted match to an active user-owned topic');
        }
        const autonomy = normalizeAutonomyDecision({
            outcome: result.requires_confirmation ? 'review_pending' : 'complete',
            confidence: result.confidence,
            risk_level: result.risk_level,
            poc: result.poc
        });
        const reviewRequest = result.review_request || (autonomy.outcome === 'review_pending' ? {
            reason: autonomy.reason || 'research_confirmation_required',
            question: '研究已完成，但有高風險或低信心後續需要確認。',
            options: ['approve', 'skip', 'research_only'],
            evidence: result.limitations || [],
            blocked_actions: result.blocked_actions || []
        } : null);
        const vaultOutcome = await writeWorkflowVaultNotes({
            workflow,
            noteInput: {
                domain: result.domain || workflow.context?.preprocess?.folder?.domain || '待整理',
                note_title: result.note_title || post.title || `貼文-${post.id.slice(0, 8)}`,
                summary: result.summary || workflow.context?.preprocess?.analysis?.summary || '',
                research: [
                    result.findings || '',
                    Array.isArray(result.verified_claims) && result.verified_claims.length
                        ? `已查證 claims：\n${result.verified_claims.map(item => `- ${item}`).join('\n')}` : '',
                    Array.isArray(result.citations) && result.citations.length
                        ? `引用：\n${result.citations.map(item => `- ${item}`).join('\n')}` : '',
                    Array.isArray(result.limitations) && result.limitations.length
                        ? `限制：\n${result.limitations.map(item => `- ${item}`).join('\n')}` : ''
                ].filter(Boolean).join('\n\n'),
                poc: result.poc_result ? JSON.stringify(result.poc_result) : '',
                decision: autonomy.outcome === 'complete' ? 'Research Cron 已完成目前可安全完成的研究。' : '研究完成，等待後續確認。',
                next_step: reviewRequest?.question || result.next_step || '研究結果已寫入，等待下一個工作流。',
                tags: result.tags || workflow.context?.preprocess?.analysis?.tags || [],
                topics: result.topics || workflow.context?.preprocess?.analysis?.topics || []
            },
            vaultRoot: options.vaultRoot
        });
        const context = {
            ...(workflow.context || {}),
            research: {
                schema_version: 1,
                status: 'completed',
                completed_at: new Date().toISOString(),
                findings: text(result.findings),
                verified_claims: Array.isArray(result.verified_claims) ? result.verified_claims.slice(0, 30) : [],
                citations: Array.isArray(result.citations) ? result.citations.slice(0, 30) : [],
                limitations: Array.isArray(result.limitations) ? result.limitations.slice(0, 30) : [],
                accepted_topics: acceptedTopics.map(({ topic, score }) => ({ id: topic.id, title: topic.title, score })),
                autonomy,
                review_request: reviewRequest,
                vault: vaultOutcome
            },
            ...(reviewRequest ? { review_request: reviewRequest } : {})
        };
        const next = autonomy.outcome === 'review_pending'
            ? { stage: 'review', status: 'awaiting_user' }
            : { stage: 'complete', status: 'completed' };
        const transitioned = await transitionWorkflow({
            workflow,
            agentIdentity: options.agentIdentity,
            stage: next.stage,
            status: next.status,
            context,
            actionPlan: actionPlan(vaultOutcome),
            failedStage: null,
            lastError: null
        }, supabase);
        await releaseHermesCronWorkflow({ workflowId: transitioned.id, agentId: options.agentIdentity }, supabase);
        return { ok: true, workflow_id: transitioned.id, stage: transitioned.stage, status: transitioned.status };
    } catch (error) {
        try {
            const current = await loadWorkflow(workflowId, supabase);
            if (current.status === 'processing' && current.locked_by === options.agentIdentity) {
                await transitionWorkflow({
                    workflow: current,
                    agentIdentity: options.agentIdentity,
                    stage: current.stage,
                    status: 'failed',
                    failedStage: current.stage,
                    lastError: error.message
                }, supabase);
            }
        } catch (persistError) {
            console.error(`[Hermes Research] Failed to persist error: ${persistError.message}`);
        }
        await releaseHermesCronWorkflow({ workflowId, agentId: options.agentIdentity }, supabase).catch(() => {});
        throw error;
    }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    researchWorkflow(args[0], { agentIdentity: option(args, '--agent'), file: option(args, '--file'), vaultRoot: option(args, '--vault') })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'RESEARCH_FAILED', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
