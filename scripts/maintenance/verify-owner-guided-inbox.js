import fs from 'node:fs/promises';
import path from 'node:path';

import { supabase, isSupabaseConfigured } from '../../server/supabaseClient.js';
import { DEFAULT_MEDIA_KNOWLEDGE_VAULT_ROOT } from '../../server/services/localMediaKnowledgeWorkflowService.js';

function requiredText(value, label) {
    const normalized = String(value ?? '').trim();
    if (!normalized) throw new Error(`${label} is required`);
    return normalized;
}

export function parseVerificationArguments(argv) {
    const options = { userId: null, vaultRoot: process.env.MEDIA_KNOWLEDGE_VAULT_PATH || DEFAULT_MEDIA_KNOWLEDGE_VAULT_ROOT };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--user-id') options.userId = requiredText(argv[++index], '--user-id');
        else if (argument === '--vault-root') options.vaultRoot = requiredText(argv[++index], '--vault-root');
        else throw new Error(`Unknown argument: ${argument}`);
    }
    if (!options.userId) throw new Error('--user-id is required');
    return options;
}

async function rows(query, label) {
    const { data, error } = await query;
    if (error) throw new Error(`${label}: ${error.message}`);
    return data || [];
}

async function markdownFiles(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return markdownFiles(target);
        return entry.isFile() && entry.name.endsWith('.md') ? [target] : [];
    }));
    return nested.flat();
}

function duplicateValues(values) {
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

function missingValues(expected, actual) {
    const actualSet = new Set(actual);
    return [...new Set(expected)].filter(value => !actualSet.has(value)).sort();
}

export async function verifyOwnerGuidedInbox({ userId, vaultRoot, supabaseClient = supabase } = {}) {
    const ownerId = requiredText(userId, 'userId');
    const root = path.resolve(requiredText(vaultRoot, 'vaultRoot'));
    const inboxPath = path.join(root, 'Media Knowledge', 'Posts', 'Inbox');
    const [posts, manifests, sourceRevisions, files] = await Promise.all([
        rows(supabaseClient.from('collection_posts').select('id').eq('user_id', ownerId), 'Collection post lookup failed'),
        rows(supabaseClient.from('owner_local_note_manifests').select('post_id, relative_path, sync_state').eq('user_id', ownerId).eq('note_kind', 'post_case_file'), 'Local manifest lookup failed'),
        rows(supabaseClient.from('collection_source_revisions').select('post_id').eq('user_id', ownerId), 'Source revision lookup failed'),
        markdownFiles(inboxPath)
    ]);
    const fileRecords = await Promise.all(files.map(async filePath => {
        const content = await fs.readFile(filePath, 'utf8');
        const postId = content.match(/^post_id:\s*(.+)\s*$/m)?.[1] || null;
        return { filePath, postId };
    }));
    const postIds = posts.map(post => post.id);
    const fileIds = fileRecords.map(file => file.postId).filter(Boolean);
    const manifestIds = manifests.map(manifest => manifest.post_id).filter(Boolean);
    const sourcePostIds = sourceRevisions.map(revision => revision.post_id).filter(Boolean);
    const report = {
        collectionPosts: postIds.length,
        sourceRevisionPosts: new Set(sourcePostIds).size,
        caseFileManifests: manifests.length,
        inboxMarkdownFiles: files.length,
        inboxUniquePostIds: new Set(fileIds).size,
        manifestsOutsideInbox: manifests.filter(manifest => !String(manifest.relative_path || '').startsWith('Media Knowledge/Posts/Inbox/')).map(manifest => manifest.post_id).sort(),
        unsynchronizedManifests: manifests.filter(manifest => manifest.sync_state !== 'synchronized').map(manifest => manifest.post_id).sort(),
        filesWithoutPostId: fileRecords.filter(file => !file.postId).map(file => path.basename(file.filePath)).sort(),
        missingSourceRevisions: missingValues(postIds, sourcePostIds),
        missingManifests: missingValues(postIds, manifestIds),
        missingInboxFiles: missingValues(postIds, fileIds),
        unexpectedInboxFiles: missingValues(fileIds, postIds),
        duplicateInboxPostIds: duplicateValues(fileIds)
    };
    report.verified = report.collectionPosts === report.sourceRevisionPosts
        && report.collectionPosts === report.caseFileManifests
        && report.collectionPosts === report.inboxMarkdownFiles
        && report.collectionPosts === report.inboxUniquePostIds
        && Object.entries(report).every(([key, value]) => key === 'verified' || !Array.isArray(value) || value.length === 0);
    return report;
}

async function main() {
    if (!isSupabaseConfigured) throw new Error('Supabase service client is not configured');
    const result = await verifyOwnerGuidedInbox(parseVerificationArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.verified) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    try {
        await main();
    } catch (error) {
        process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
        process.exitCode = 1;
    }
}
