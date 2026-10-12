import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { supabase, isSupabaseConfigured } from '../../server/supabaseClient.js';
import {
    createOrRetryLocalPostCaseFile,
    rehomeLocalPostCaseFileToInbox
} from '../../server/services/localMediaKnowledgeWorkflowService.js';

const __filename = fileURLToPath(import.meta.url);
const PIPELINE_VERSION = 'owner-guided-inbox-backfill-v1';
const MAX_PAGE_SIZE = 100;

function nonEmptyText(value) {
    const normalized = String(value ?? '').replace(/\0/g, '').trim();
    return normalized || null;
}

function positiveInteger(value, label) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
    return parsed;
}

export function parseBackfillArguments(argv) {
    const options = { apply: false, userId: null, pageSize: 25, limit: null, offset: 0, concurrency: 4, forceInbox: false };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--apply') options.apply = true;
        else if (argument === '--force-inbox') options.forceInbox = true;
        else if (argument === '--user-id') options.userId = nonEmptyText(argv[++index]);
        else if (argument === '--page-size') options.pageSize = positiveInteger(argv[++index], '--page-size');
        else if (argument === '--limit') options.limit = positiveInteger(argv[++index], '--limit');
        else if (argument === '--offset') options.offset = Number(argv[++index]);
        else if (argument === '--concurrency') options.concurrency = positiveInteger(argv[++index], '--concurrency');
        else throw new Error(`Unknown argument: ${argument}`);
    }
    if (options.pageSize > MAX_PAGE_SIZE) throw new Error(`--page-size must be at most ${MAX_PAGE_SIZE}`);
    if (options.concurrency > 12) throw new Error('--concurrency must be at most 12');
    if (!Number.isInteger(options.offset) || options.offset < 0) throw new Error('--offset must be a non-negative integer');
    if (options.apply && !options.userId) throw new Error('--user-id is required with --apply');
    return options;
}

export function buildHistoricalSourceRevision(post, media = [], comments = []) {
    const postId = nonEmptyText(post?.id);
    const userId = nonEmptyText(post?.user_id);
    if (!postId || !userId) throw new Error('Historical source revision requires post.id and post.user_id');
    return {
        user_id: userId,
        post_id: postId,
        correlation_id: `historical-inbox-${postId}`,
        pipeline_version: PIPELINE_VERSION,
        capture_quality: 'partial',
        source_payload: {
            schema_version: 1,
            source: 'historical_collection_import',
            post: {
                platform: nonEmptyText(post.platform) || 'generic',
                original_url: nonEmptyText(post.original_url),
                title: nonEmptyText(post.title),
                author_name: nonEmptyText(post.author_name),
                author_id: nonEmptyText(post.author_id),
                content: nonEmptyText(post.content),
                posted_at: post.posted_at || null,
                source_type: 'historical_collection_import'
            },
            media: Array.isArray(media) ? media.map(item => ({
                type: nonEmptyText(item?.type) || 'media',
                url: nonEmptyText(item?.url),
                order: Number.isInteger(item?.order) ? item.order : null,
                storage_bucket: nonEmptyText(item?.storage_bucket),
                storage_path: nonEmptyText(item?.storage_path),
                content_type: nonEmptyText(item?.content_type),
                byte_size: Number.isFinite(Number(item?.byte_size)) ? Number(item.byte_size) : null,
                original_filename: nonEmptyText(item?.original_filename)
            })).filter(item => item.url || item.storage_path) : [],
            comments: Array.isArray(comments) ? comments.map(item => ({
                author_name: nonEmptyText(item?.author_name),
                content: nonEmptyText(item?.content),
                commented_at: item?.commented_at || null
            })).filter(item => item.content) : []
        }
    };
}

async function rows(query, label) {
    const { data, error } = await query;
    if (error) throw new Error(`${label}: ${error.message}`);
    return data || [];
}

async function latestSourceRevision({ userId, postId, supabaseClient }) {
    const revisions = await rows(
        supabaseClient.from('collection_source_revisions')
            .select('id, capture_quality, source_payload, created_at')
            .eq('user_id', userId).eq('post_id', postId)
            .order('created_at', { ascending: false }).limit(1),
        'Source revision lookup failed'
    );
    return revisions[0] || null;
}

async function historicalMediaAndComments({ userId, postId, supabaseClient }) {
    const [media, comments] = await Promise.all([
        rows(supabaseClient.from('collection_post_media')
            .select('type, url, order, storage_bucket, storage_path, content_type, byte_size, original_filename')
            .eq('user_id', userId).eq('post_id', postId).order('order', { ascending: true }), 'Historical media lookup failed'),
        rows(supabaseClient.from('collection_post_comments')
            .select('author_name, content, commented_at')
            .eq('user_id', userId).eq('post_id', postId).order('commented_at', { ascending: true }), 'Historical comments lookup failed')
    ]);
    return { media, comments };
}

async function ensureHistoricalSourceRevision({ post, apply, supabaseClient }) {
    const current = await latestSourceRevision({ userId: post.user_id, postId: post.id, supabaseClient });
    if (current) return { revision: current, created: false };
    const { media, comments } = await historicalMediaAndComments({ userId: post.user_id, postId: post.id, supabaseClient });
    const historical = buildHistoricalSourceRevision(post, media, comments);
    if (!apply) return { revision: null, created: true, dryRun: true };
    const { error } = await supabaseClient.from('collection_source_revisions')
        .upsert(historical, { onConflict: 'user_id,correlation_id', ignoreDuplicates: true });
    if (error) throw new Error(`Historical source revision creation failed: ${error.message}`);
    const revision = await latestSourceRevision({ userId: post.user_id, postId: post.id, supabaseClient });
    if (!revision) throw new Error('Historical source revision was not found after creation');
    return { revision, created: true };
}

async function postPage({ userId, offset, limit, supabaseClient }) {
    let query = supabaseClient.from('collection_posts')
        .select('id, user_id, platform, original_url, title, author_name, author_id, content, posted_at, created_at')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);
    if (userId) query = query.eq('user_id', userId);
    return rows(query, 'Collection post page lookup failed');
}

async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await worker(items[index]);
        }
    });
    await Promise.all(runners);
    return results;
}

export async function backfillOwnerGuidedInbox({
    apply = false,
    userId = null,
    pageSize = 25,
    limit = null,
    offset = 0,
    concurrency = 4,
    forceInbox = false,
    supabaseClient = supabase,
    createCaseFile = createOrRetryLocalPostCaseFile,
    rehomeCaseFile = rehomeLocalPostCaseFileToInbox,
    log = () => {}
} = {}) {
    if (apply && !userId) throw new Error('userId is required when apply is true');
    if (forceInbox && !apply) throw new Error('--force-inbox requires --apply');
    if (!isSupabaseConfigured && supabaseClient === supabase) throw new Error('Supabase service client is not configured');
    const stats = {
        mode: apply ? 'apply' : 'dry-run', userId, discovered: 0, existingRevisions: 0,
        historicalRevisions: 0, caseFilesSynchronized: 0, missingBody: 0, failures: []
    };
    let currentOffset = offset;
    while (limit === null || stats.discovered < limit) {
        const requested = Math.min(pageSize, limit === null ? pageSize : limit - stats.discovered);
        const posts = await postPage({ userId, offset: currentOffset, limit: requested, supabaseClient });
        if (!posts.length) break;
        const outcomes = await mapWithConcurrency(posts, concurrency, async post => {
            try {
                const source = await ensureHistoricalSourceRevision({ post, apply, supabaseClient });
                if (apply) {
                    const result = await createCaseFile({ userId: post.user_id, postId: post.id });
                    const rehomed = forceInbox
                        ? await rehomeCaseFile({ userId: post.user_id, postId: post.id })
                        : result;
                    return { post, source, synchronized: rehomed?.manifest?.sync_state === 'synchronized' };
                }
                return { post, source, synchronized: false };
            } catch (error) {
                return { post, error: String(error?.message || error).slice(0, 300) };
            }
        });
        for (const outcome of outcomes) {
            stats.discovered += 1;
            if (!nonEmptyText(outcome.post.content)) stats.missingBody += 1;
            if (outcome.error) {
                stats.failures.push({ postId: outcome.post.id, error: outcome.error });
                log({ postId: outcome.post.id, error: outcome.error });
                continue;
            }
            if (outcome.source.created) stats.historicalRevisions += 1;
            else stats.existingRevisions += 1;
            if (outcome.synchronized) stats.caseFilesSynchronized += 1;
            log({ postId: outcome.post.id, sourceRevisionId: outcome.source.revision?.id || null, createdRevision: outcome.source.created, applied: apply });
        }
        currentOffset += posts.length;
        if (posts.length < requested || stats.failures.length) break;
    }
    return stats;
}

async function main() {
    const options = parseBackfillArguments(process.argv.slice(2));
    const result = await backfillOwnerGuidedInbox(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.failures.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    try {
        await main();
    } catch (error) {
        process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
        process.exitCode = 1;
    }
}
