import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
    buildAutomationContext,
    normalizePreprocessInput
} from '../../server/services/autonomyPolicyService.js';
import {
    persistFolderDecision,
    persistSourceIdentity,
    persistTopicDecision
} from '../../server/services/autonomousKnowledgeService.js';
import {
    getWorkflowPost,
    loadWorkflow,
    transitionWorkflow
} from '../../server/services/postWorkflowService.js';
import { writeWorkflowVaultNotes } from '../../server/services/vaultNoteService.js';
import { runPocWorkflow } from '../../server/services/pocService.js';
import { releaseHermesCronWorkflow } from '../../server/services/hermesCronService.js';
import { storePreparedContentDraft } from '../../server/services/contentRouteService.js';
import { upsertPostSearchDocument } from '../../server/services/postSearchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

async function readResult(file) {
    if (!file) throw new Error('--file <preprocess-result.json> is required');
    const raw = await readFile(path.resolve(file), 'utf8');
    if (Buffer.byteLength(raw) > 256 * 1024) throw new Error('Preprocess result must be 256 KB or smaller');
    const value = JSON.parse(raw);
    return normalizePreprocessInput(value);
}

function sourceUrl(post) {
    return post?.platform === 'image' ? '（圖片上傳，無公開連結）' : (post?.original_url || '（無原文連結）');
}

function contentAction(contentDraft) {
    if (!contentDraft?.content_asset_id) return null;
    return {
        type: contentDraft.route_type === 'quick_rewrite' ? 'fast_rewrite' : contentDraft.route_type,
        status: 'completed',
        requested_by: 'hermes:preprocess',
        requested_at: new Date().toISOString(),
        completed_by: 'hermes:preprocess',
        completed_at: new Date().toISOString(),
        outcome: contentDraft
    };
}

function actionPlan(vaultOutcome, contentDraft) {
    const actions = [];
    const generated = contentAction(contentDraft);
    if (generated) actions.push(generated);
    actions.push({
        type: 'vault_note',
        status: 'completed',
        requested_by: 'hermes:preprocess',
        requested_at: new Date().toISOString(),
        completed_by: 'hermes:preprocess',
        completed_at: new Date().toISOString(),
        outcome: vaultOutcome
    });
    return {
        schema_version: 2,
        actions
    };
}

function deferredVaultActionPlan(contentDraft) {
    const actions = [];
    const generated = contentAction(contentDraft);
    if (generated) actions.push(generated);
    actions.push({
        type: 'vault_note',
        status: 'pending',
        requested_by: 'codex:db-preprocess',
        requested_at: new Date().toISOString(),
        notes: 'Write the prepared note to the configured Claude-Obsidian Vault before finalizing this workflow.'
    });
    return {
        schema_version: 2,
        actions
    };
}

function compactPocResult(result) {
    if (!result) return null;
    return {
        run_id: result.run_id || null,
        status: result.status || null,
        stage: result.stage || null,
        execution: result.execution ? {
            success: Boolean(result.execution.success),
            status: result.execution.status || null,
            exit_code: result.execution.exit_code ?? null,
            stdout: String(result.execution.stdout || '').slice(0, 8_000),
            stderr: String(result.execution.stderr || '').slice(0, 8_000),
            duration_ms: result.execution.duration_ms || null
        } : null,
        error: String(result.error || '').slice(0, 4_000) || null
    };
}

function toNoteInput(result, post, persistence, pocResult, folderPersistence, contentDraft) {
    const review = result.review_request;
    const decision = result.autonomy.outcome === 'complete'
        ? 'Hermes 依據高信心且低風險規則完成預處理。'
        : result.autonomy.outcome === 'research_pending'
            ? '預處理已完成，等待 Research Cron 進一步研究。'
            : '預處理已完成，部分高風險或低信心項目等待後續確認。';
    return {
        note_title: result.folder.note_title || post.title || `貼文-${post.id.slice(0, 8)}`,
        summary: result.analysis.summary,
        original_content: post.platform === 'image' ? (post.content || '') : undefined,
        discussion: [
            `自動分類：${result.analysis.primary_category}`,
            `關係判斷：${result.relation?.kind || '未提供'}`,
            `分類建議：${result.folder.suggested_name || result.folder.domain || '未提供'}`,
            persistence.exact_duplicate
                ? `Exact duplicate：${persistence.exact_duplicate.id}${persistence.exact_duplicate.collection_id ? '（沿用原資料夾）' : ''}`
                : folderPersistence?.inherited_from_related
                    ? `Related source：${folderPersistence.inherited_from_related}（沿用原資料夾）`
                    : 'Exact duplicate：未發現'
        ].join('\n'),
        research: [
            result.research.questions.length ? `待研究問題：\n${result.research.questions.map(item => `- ${item}`).join('\n')}` : '',
            result.research.candidates.length ? `研究候選：\n${result.research.candidates.map(item => `- ${item}`).join('\n')}` : ''
        ].filter(Boolean).join('\n\n'),
        poc: result.poc
            ? `候選：${result.poc.candidate || '未命名'}\n目標：${result.poc.objective || '未提供'}\n網路需求：${result.poc.network_required ? '需要' : '不需要'}\n結果：${JSON.stringify(pocResult || result.poc.result || null)}`
            : '',
        decision,
        next_step: review
            ? `${review.question}\n選項：${review.options.join('、')}`
            : result.autonomy.outcome === 'research_pending'
                ? '交由 Research Cron 優先處理。'
                : '已完成目前可安全自動完成的工作。',
        primary_category: result.analysis.primary_category,
        tags: result.analysis.tags,
        topics: result.analysis.topics,
        replication: result.vault.replication || undefined,
        source_url: sourceUrl(post),
        content_draft: contentDraft
            ? {
                ...contentDraft,
                status: 'draft',
                published: false
            }
            : null
    };
}

export async function preprocessWorkflow(workflowId, options = {}) {
    if (!options.agentIdentity) throw new Error('--agent <identity> is required');
    const { supabase } = await import('../../server/supabaseClient.js');
    let workflow = await loadWorkflow(workflowId, supabase);
    if (workflow.status !== 'processing' || workflow.locked_by !== options.agentIdentity) {
        throw new Error(`Workflow ${workflow.id} is not leased by ${options.agentIdentity}`);
    }
    if (!['base_analysis', 'triage', 'preprocessing'].includes(workflow.stage)) {
        throw new Error(`Workflow ${workflow.id} is not ready for preprocessing (${workflow.stage}/${workflow.status})`);
    }

    try {
        const result = await readResult(options.file);
        const post = getWorkflowPost(workflow);
        if (!post) throw new Error(`Workflow ${workflow.id} has no source post`);

        const persistence = await persistSourceIdentity(workflow, supabase);
        const topicPersistence = await persistTopicDecision(workflow, result.topic, result.relation, supabase);
        const folderPersistence = await persistFolderDecision(
            workflow,
            result.folder,
            supabase,
            {
                duplicate: persistence.exact_duplicate,
                relatedMatches: result.relation?.confidence >= 0.85
                    ? result.relation.matches
                    : []
            }
        );

        let pocResult = null;
        if (result.poc?.auto_execute
            && result.autonomy.outcome !== 'review_pending'
            && !result.poc.network_required
            && !result.poc.secrets_required
            && result.poc.artifact) {
            try {
                pocResult = await runPocWorkflow({ postData: post, artifact: result.poc.artifact }, { supabaseClient: supabase });
                result.poc.result = compactPocResult(pocResult);
            } catch (error) {
                pocResult = compactPocResult(error.pocResult) || { status: 'error', error: error.message };
                result.poc.result = pocResult;
                if (result.autonomy.outcome === 'complete') {
                    result.autonomy.outcome = 'research_pending';
                    result.autonomy.reason = 'offline_poc_failed';
                }
            }
        }

        let contentDraft = null;
        const output = result.content_output;
        const outputConfidence = Number(output?.confidence || 0);
        const canAutoRewrite = output?.mode === 'fast_rewrite'
            && output?.body
            && outputConfidence >= 0.85
            && result.autonomy.outcome !== 'review_pending';
        const canAutoSynthesize = output?.mode === 'content_synthesis'
            && output?.body
            && outputConfidence >= 0.85
            && (pocResult?.status === 'completed' || result.research.candidates.length > 0)
            && result.autonomy.outcome !== 'review_pending';
        if (canAutoRewrite || canAutoSynthesize) {
            contentDraft = await storePreparedContentDraft({
                postData: post,
                routeType: output.mode,
                contentOutput: output
            }, {
                supabaseClient: supabase,
                pocRunId: pocResult?.run_id || null
            });
        }

        const noteInput = toNoteInput(result, post, persistence, pocResult, folderPersistence, contentDraft);
        const next = result.autonomy.outcome === 'complete'
        ? { stage: 'complete', status: 'completed' }
        : result.autonomy.outcome === 'research_pending'
            ? { stage: 'research', status: 'pending' }
            : { stage: 'review', status: 'awaiting_user' };
        if (options.deferVault) {
            const context = buildAutomationContext(result, {
                source_identity: persistence,
                topic_persistence: topicPersistence,
                folder_persistence: folderPersistence,
                vault: { status: 'pending', relative_path: null },
                vault_sync: {
                    status: 'pending',
                    target_stage: next.stage,
                    target_status: next.status,
                    note_input: noteInput,
                    queued_at: new Date().toISOString()
                },
                source_url: sourceUrl(post)
            });
            const transitioned = await transitionWorkflow({
                workflow,
                agentIdentity: options.agentIdentity,
                stage: 'vault_sync',
                status: 'pending',
                context,
                actionPlan: deferredVaultActionPlan(contentDraft),
                failedStage: null,
                lastError: null
            }, supabase);
            await upsertPostSearchDocument(post, {
                supabaseClient: supabase,
                analysis: result.analysis,
                workflow: transitioned,
                generated: result.search,
                contentDraft: contentDraft?.body || null
            }).catch(error => console.warn(`[Hermes Preprocess] Search projection skipped: ${error.message}`));
            await releaseHermesCronWorkflow({ workflowId: transitioned.id, agentId: options.agentIdentity }, supabase);
            return {
                ok: true,
                workflow_id: transitioned.id,
                stage: transitioned.stage,
                status: transitioned.status,
                target_stage: next.stage,
                target_status: next.status,
                autonomy: result.autonomy,
                exact_duplicate: persistence.exact_duplicate?.id || null,
                vault_path: null,
                content_draft: contentDraft,
                poc: result.poc?.result || null
            };
        }

        const vaultOutcome = await writeWorkflowVaultNotes({ workflow, noteInput, vaultRoot: options.vaultRoot });
        if (contentDraft && vaultOutcome.draft_path) contentDraft.relative_path = vaultOutcome.draft_path;
        const context = buildAutomationContext(result, {
            source_identity: persistence,
            topic_persistence: topicPersistence,
            folder_persistence: folderPersistence,
            vault: vaultOutcome,
            source_url: sourceUrl(post)
        });
        const transitioned = await transitionWorkflow({
            workflow,
            agentIdentity: options.agentIdentity,
            stage: next.stage,
            status: next.status,
            context,
            actionPlan: actionPlan(vaultOutcome, contentDraft),
            failedStage: null,
            lastError: null
        }, supabase);
        await releaseHermesCronWorkflow({ workflowId: transitioned.id, agentId: options.agentIdentity }, supabase);
        await upsertPostSearchDocument(post, {
            supabaseClient: supabase,
            analysis: result.analysis,
            workflow: transitioned,
            generated: result.search,
            contentDraft: contentDraft?.body || null
        }).catch(error => console.warn(`[Hermes Preprocess] Search projection skipped: ${error.message}`));
        return {
            ok: true,
            workflow_id: transitioned.id,
            stage: transitioned.stage,
            status: transitioned.status,
            autonomy: result.autonomy,
            exact_duplicate: persistence.exact_duplicate?.id || null,
            vault_path: vaultOutcome.relative_path,
            content_draft: contentDraft,
            poc: result.poc?.result || null
        };
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
            console.error(`[Hermes Preprocess] Failed to persist error: ${persistError.message}`);
        }
        await releaseHermesCronWorkflow({ workflowId, agentId: options.agentIdentity }, supabase).catch(() => {});
        throw error;
    }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const args = process.argv.slice(2);
    preprocessWorkflow(args[0], {
        agentIdentity: option(args, '--agent'),
        file: option(args, '--file'),
        vaultRoot: option(args, '--vault'),
        deferVault: args.includes('--defer-vault')
    })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'PREPROCESS_FAILED', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
