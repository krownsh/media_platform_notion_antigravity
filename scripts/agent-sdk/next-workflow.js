import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { getWorkflowPost, selectNextWorkflow } from '../../server/services/postWorkflowService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

export const ORIGINAL_CONTENT_PREVIEW_LIMIT = 1_000;

function contentPreview(value) {
    const content = String(value || '');
    return {
        preview: content.slice(0, ORIGINAL_CONTENT_PREVIEW_LIMIT),
        length: content.length,
        truncated: content.length > ORIGINAL_CONTENT_PREVIEW_LIMIT
    };
}

function capturedContent(post) {
    if (typeof post?.content === 'string' && post.content.length > 0) return post.content;
    const full = post?.full_json && typeof post.full_json === 'object' ? post.full_json : {};
    return full.content || full.text || full.raw_content || '';
}

export function formatWorkflow(workflow) {
    const post = getWorkflowPost(workflow);
    const analysis = Array.isArray(post?.collection_post_analysis)
        ? post.collection_post_analysis[0]
        : post?.collection_post_analysis;
    const original = contentPreview(capturedContent(post));
    return {
        workflow_id: workflow.id,
        outbox_id: workflow.outbox_event_id,
        source_type: workflow.source_type,
        stage: workflow.stage,
        status: workflow.status,
        failed_stage: workflow.failed_stage,
        last_error: workflow.last_error,
        automation: workflow.context?.automation || null,
        review_request: workflow.context?.review_request || null,
        action_plan: workflow.action_plan,
        post: {
            id: post?.id,
            platform: post?.platform,
            url: post?.platform === 'image' ? null : post?.original_url,
            title: post?.title,
            author: post?.author_name,
            // Keep the CLI safe for an interactive Hermes prompt: the source
            // remains in Supabase, while this response exposes exactly the
            // first 1,000 characters and an explicit truncation flag.
            content: original.preview,
            content_preview: original.preview,
            content_length: original.length,
            content_truncated: original.truncated,
            original_url: post?.platform === 'image' ? null : post?.original_url,
            media_count: Array.isArray(post?.collection_post_media) ? post.collection_post_media.length : 0,
            analysis: analysis ? {
                status: analysis.analysis_status || null,
                source: analysis.analysis_source || null,
                summary: analysis.summary || null,
                primary_category: analysis.primary_category || null,
                tags: analysis.tags || [],
                topics: analysis.topics || []
            } : null
        }
    };
}

export async function getNextWorkflow(options = {}) {
    const { supabase } = await import('../../server/supabaseClient.js');
    const selected = await selectNextWorkflow({ interactive: Boolean(options.interactive) }, supabase);
    if (!selected) return { ok: true, workflow: null, message: 'No incomplete workflow is available.' };
    return { ok: true, selection: selected.selection, workflow: formatWorkflow(selected.workflow) };
}

async function main() {
    const args = process.argv.slice(2);
    const result = await getNextWorkflow({ interactive: args.includes('--interactive') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main().catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
        process.exitCode = 1;
    });
}
