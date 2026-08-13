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

function actionPlan(vaultOutcome) {
    return {
        schema_version: 2,
        actions: [{
            type: 'vault_note',
            status: 'completed',
            requested_by: 'hermes:preprocess',
            requested_at: new Date().toISOString(),
            completed_by: 'hermes:preprocess',
            completed_at: new Date().toISOString(),
            outcome: vaultOutcome
        }]
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

function toNoteInput(result, post, persistence, pocResult, folderPersistence) {
    const review = result.review_request;
    const decision = result.autonomy.outcome === 'complete'
        ? 'Hermes 依據高信心且低風險規則完成預處理。'
        : result.autonomy.outcome === 'research_pending'
            ? '預處理已完成，等待 Research Cron 進一步研究。'
            : '預處理已完成，部分高風險或低信心項目等待後續確認。';
    return {
        domain: result.folder.domain || '待整理',
        note_title: result.folder.note_title || post.title || `貼文-${post.id.slice(0, 8)}`,
        summary: result.analysis.summary,
        original_content: post.platform === 'image' ? (post.content || '') : undefined,
        discussion: [
            `自動分類：${result.analysis.primary_category}`,
            `關係判斷：${result.relation?.kind || '未提供'}`,
            `資料夾：${result.folder.domain || '待整理'}`,
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
        source_url: sourceUrl(post)
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
        if ((folderPersistence.inherited_from_duplicate || folderPersistence.inherited_from_related)
            && folderPersistence.collection?.name) {
            result.folder.domain = folderPersistence.collection.name;
        }

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

        const noteInput = toNoteInput(result, post, persistence, pocResult, folderPersistence);
        const vaultOutcome = await writeWorkflowVaultNotes({ workflow, noteInput, vaultRoot: options.vaultRoot });
        const context = buildAutomationContext(result, {
        source_identity: persistence,
        topic_persistence: topicPersistence,
        folder_persistence: folderPersistence,
        vault: vaultOutcome,
        source_url: sourceUrl(post)
        });
        const next = result.autonomy.outcome === 'complete'
        ? { stage: 'complete', status: 'completed' }
        : result.autonomy.outcome === 'research_pending'
            ? { stage: 'research', status: 'pending' }
            : { stage: 'review', status: 'awaiting_user' };
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
        return {
            ok: true,
            workflow_id: transitioned.id,
            stage: transitioned.stage,
            status: transitioned.status,
            autonomy: result.autonomy,
            exact_duplicate: persistence.exact_duplicate?.id || null,
            vault_path: vaultOutcome.relative_path,
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
        vaultRoot: option(args, '--vault')
    })
        .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch(error => {
            process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'PREPROCESS_FAILED', error: error.message })}\n`);
            process.exitCode = 1;
        });
}
