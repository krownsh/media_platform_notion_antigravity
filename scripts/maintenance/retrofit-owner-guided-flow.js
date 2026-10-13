import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { supabase, isSupabaseConfigured } from '../../server/supabaseClient.js';
import { refreshOwnerPostSearchDocument } from '../../server/services/ownerSearchService.js';
import { ensureReviewPacket } from '../../server/services/reviewPacketService.js';
import { ensureCandidateGenerationJob } from '../../server/services/ownerCandidateGenerationService.js';

const __filename = fileURLToPath(import.meta.url);
const PAGE_SIZE_MAX = 100;

function requiredText(value, label) {
    const result = String(value ?? '').trim();
    if (!result) throw new Error(`${label} is required`);
    return result;
}

function positiveInteger(value, label) {
    const result = Number(value);
    if (!Number.isInteger(result) || result < 1) throw new Error(`${label} must be a positive integer`);
    return result;
}

export function parseRetrofitArguments(argv) {
    const options = { apply: false, userId: null, pageSize: 25, limit: null, offset: 0, concurrency: 3 };
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (value === '--apply') options.apply = true;
        else if (value === '--user-id') options.userId = requiredText(argv[++index], '--user-id');
        else if (value === '--page-size') options.pageSize = positiveInteger(argv[++index], '--page-size');
        else if (value === '--limit') options.limit = positiveInteger(argv[++index], '--limit');
        else if (value === '--offset') options.offset = Number(argv[++index]);
        else if (value === '--concurrency') options.concurrency = positiveInteger(argv[++index], '--concurrency');
        else throw new Error(`Unknown argument: ${value}`);
    }
    if (!options.userId) throw new Error('--user-id is required');
    if (options.pageSize > PAGE_SIZE_MAX) throw new Error(`--page-size must be at most ${PAGE_SIZE_MAX}`);
    if (!Number.isInteger(options.offset) || options.offset < 0) throw new Error('--offset must be a non-negative integer');
    if (options.concurrency > 8) throw new Error('--concurrency must be at most 8');
    return options;
}

async function rows(query, label) {
    const { data, error } = await query;
    if (error) throw new Error(`${label}: ${error.message}`);
    return data || [];
}

async function latestRevision({ userId, postId, supabaseClient }) {
    const revisions = await rows(supabaseClient.from('collection_source_revisions')
        .select('id, capture_quality, created_at')
        .eq('user_id', userId).eq('post_id', postId)
        .order('created_at', { ascending: false }).limit(1), 'Source revision lookup failed');
    return revisions[0] || null;
}

async function mapWithConcurrency(items, concurrency, work) {
    const results = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(items.length, concurrency) }, async () => {
        while (next < items.length) {
            const index = next; next += 1;
            results[index] = await work(items[index]);
        }
    }));
    return results;
}

/**
 * Reconciles only the current owner-guided layers for existing captured posts.
 * It has no legacy table reads and never creates/accepts semantic proposals.
 */
export async function retrofitOwnerGuidedFlow({
    apply = false,
    userId,
    pageSize = 25,
    limit = null,
    offset = 0,
    concurrency = 3,
    supabaseClient = supabase,
    refreshSearch = refreshOwnerPostSearchDocument,
    ensurePacket = ensureReviewPacket,
    ensureJob = ensureCandidateGenerationJob,
    log = () => {}
} = {}) {
    userId = requiredText(userId, 'userId');
    if (!isSupabaseConfigured && supabaseClient === supabase) throw new Error('Supabase service client is not configured');
    const stats = { mode: apply ? 'apply' : 'dry-run', userId, discovered: 0, complete: 0, partial: 0, missingRevision: 0, searchRebuilt: 0, packetsEnsured: 0, jobsEnsured: 0, failures: [] };
    let currentOffset = offset;
    while (limit === null || stats.discovered < limit) {
        const take = Math.min(pageSize, limit === null ? pageSize : limit - stats.discovered);
        const posts = await rows(supabaseClient.from('collection_posts').select('id')
            .eq('user_id', userId).order('created_at', { ascending: true }).order('id', { ascending: true })
            .range(currentOffset, currentOffset + take - 1), 'Collection post page lookup failed');
        if (!posts.length) break;
        const outcomes = await mapWithConcurrency(posts, concurrency, async post => {
            try {
                const revision = await latestRevision({ userId, postId: post.id, supabaseClient });
                if (!revision) return { postId: post.id, missingRevision: true };
                if (!apply) return { postId: post.id, revision };
                await refreshSearch({ userId, postId: post.id, sourceRevisionId: revision.id, supabaseClient });
                const packet = await ensurePacket({ userId, sourceRevisionId: revision.id, supabaseClient });
                await ensureJob({ userId, sourceRevisionId: revision.id, reviewPacketId: packet.id, captureQuality: revision.capture_quality, supabaseClient });
                return { postId: post.id, revision, synchronized: true };
            } catch (error) {
                return { postId: post.id, error: String(error?.message || error).slice(0, 300) };
            }
        });
        for (const outcome of outcomes) {
            stats.discovered += 1;
            if (outcome.error) { stats.failures.push(outcome); log(outcome); continue; }
            if (outcome.missingRevision) { stats.missingRevision += 1; log(outcome); continue; }
            if (outcome.revision.capture_quality === 'complete') stats.complete += 1;
            else stats.partial += 1;
            if (apply && outcome.synchronized) { stats.searchRebuilt += 1; stats.packetsEnsured += 1; stats.jobsEnsured += 1; }
            log({ postId: outcome.postId, sourceRevisionId: outcome.revision.id, captureQuality: outcome.revision.capture_quality, applied: apply });
        }
        currentOffset += posts.length;
        if (posts.length < take) break;
    }
    return stats;
}

async function main() {
    const options = parseRetrofitArguments(process.argv.slice(2));
    const result = await retrofitOwnerGuidedFlow({ ...options, log: event => {
        if (event.error) process.stderr.write(`${JSON.stringify(event)}\n`);
    } });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.failures.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    main().catch(error => { process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = 1; });
}
