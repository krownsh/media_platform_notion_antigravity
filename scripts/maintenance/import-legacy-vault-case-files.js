import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { supabase, isSupabaseConfigured } from '../../server/supabaseClient.js';
import { buildLegacyVaultInventory } from '../../server/services/legacyVaultInventoryService.js';
import { createOrRetryLocalPostCaseFile } from '../../server/services/localMediaKnowledgeWorkflowService.js';

const MAX_BATCH_SIZE = 15;

function requiredEnvironment(name) {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
}

function requestedPostIds() {
    const ids = requiredEnvironment('LEGACY_IMPORT_POST_IDS').split(',').map(value => value.trim()).filter(Boolean);
    if (!ids.length || ids.length > MAX_BATCH_SIZE) throw new Error(`LEGACY_IMPORT_POST_IDS must contain 1-${MAX_BATCH_SIZE} IDs`);
    if (new Set(ids).size !== ids.length) throw new Error('LEGACY_IMPORT_POST_IDS must not contain duplicate IDs');
    return ids;
}

function provisionalTitle(relativePath) {
    const filename = path.basename(relativePath, '.md');
    return filename
        .replace(/^\d{4}-\d{2}-\d{2}-/, '')
        .replace(/--[0-9a-f]{8,}$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function correlationId(postId, legacySha256) {
    return `legacy-vault-import:${postId}:${legacySha256.slice(0, 24)}`;
}

async function loadSourceSnapshot({ userId, postId }) {
    const { data: post, error: postError } = await supabase
        .from('collection_posts')
        .select('id, user_id, platform, original_url, title, author_name, author_id, content, posted_at, is_archived, full_json, source_domains')
        .eq('id', postId).eq('user_id', userId).maybeSingle();
    if (postError || !post) throw new Error(`Collection post lookup failed for ${postId}: ${postError?.message || 'not found'}`);

    const [mediaResult, commentsResult] = await Promise.all([
        supabase.from('collection_post_media').select('type, url, "order", storage_bucket, storage_path, content_type, byte_size, original_filename').eq('post_id', postId).eq('user_id', userId).order('order', { ascending: true }),
        supabase.from('collection_post_comments').select('author_name, content, commented_at, raw_data').eq('post_id', postId).eq('user_id', userId).order('commented_at', { ascending: true })
    ]);
    if (mediaResult.error) throw new Error(`Media lookup failed for ${postId}: ${mediaResult.error.message}`);
    if (commentsResult.error) throw new Error(`Comment lookup failed for ${postId}: ${commentsResult.error.message}`);
    return { post, media: mediaResult.data || [], comments: commentsResult.data || [] };
}

async function ensureLegacySourceRevision({ userId, postId, legacySha256 }) {
    const id = correlationId(postId, legacySha256);
    const { data: existing, error: existingError } = await supabase
        .from('collection_source_revisions')
        .select('id').eq('user_id', userId).eq('correlation_id', id).maybeSingle();
    if (existingError) throw new Error(`Legacy source revision lookup failed for ${postId}: ${existingError.message}`);
    if (existing) return existing.id;

    const { post, media, comments } = await loadSourceSnapshot({ userId, postId });
    const sourcePayload = {
        schema_version: 1,
        source: 'legacy_vault_import',
        post: { ...post, source_type: 'legacy_vault_import' },
        media,
        comments
    };
    const { data: created, error: createError } = await supabase
        .from('collection_source_revisions')
        .insert({
            user_id: userId,
            post_id: postId,
            correlation_id: id,
            pipeline_version: 'legacy-vault-import-v1',
            capture_quality: 'partial',
            source_payload: sourcePayload
        })
        .select('id')
        .single();
    if (createError || !created) throw new Error(`Legacy source revision creation failed for ${postId}: ${createError?.message || 'not returned'}`);
    return created.id;
}

async function loadCaseFileInputs({ userId, postId, sourceRevisionId }) {
    const [postResult, revisionResult] = await Promise.all([
        supabase.from('collection_posts')
            .select('id, user_id, platform, original_url, title, author_name, content, created_at')
            .eq('id', postId).eq('user_id', userId).maybeSingle(),
        supabase.from('collection_source_revisions')
            .select('id, post_id, capture_quality, source_payload')
            .eq('id', sourceRevisionId).eq('post_id', postId).eq('user_id', userId).maybeSingle()
    ]);
    if (postResult.error || !postResult.data) throw new Error(`Case-file post lookup failed for ${postId}: ${postResult.error?.message || 'not found'}`);
    if (revisionResult.error || !revisionResult.data) throw new Error(`Case-file source revision lookup failed for ${postId}: ${revisionResult.error?.message || 'not found'}`);
    return { post: postResult.data, sourceRevision: revisionResult.data };
}

async function loadLegacyRecord({ legacyVaultRoot, inventoryByPostId, postId }) {
    const records = inventoryByPostId.get(postId) || [];
    if (records.length !== 1) throw new Error(`Expected exactly one legacy post candidate for ${postId}; found ${records.length}`);
    const record = records[0];
    const fullPath = path.resolve(legacyVaultRoot, record.relativePath);
    const relative = path.relative(legacyVaultRoot, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Legacy path escapes its Vault for ${postId}`);
    const content = await fs.readFile(fullPath, 'utf8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex');
    if (checksum !== record.sha256) throw new Error(`Legacy file changed during inventory for ${postId}`);
    return { ...record, content, title: provisionalTitle(record.relativePath) };
}

async function main() {
    if (!isSupabaseConfigured) throw new Error('Supabase service client is not configured');
    const userId = requiredEnvironment('OWNER_ID');
    const legacyVaultRoot = path.resolve(requiredEnvironment('LEGACY_MEDIA_VAULT_ROOT'));
    const vaultRoot = path.resolve(requiredEnvironment('MEDIA_KNOWLEDGE_VAULT_ROOT'));
    const postIds = requestedPostIds();
    const inventory = await buildLegacyVaultInventory({ vaultRoot: legacyVaultRoot });
    const inventoryByPostId = new Map();
    for (const record of inventory.filter(item => item.candidateKind === 'post_candidate' && item.postId)) {
        const records = inventoryByPostId.get(record.postId) || [];
        records.push(record);
        inventoryByPostId.set(record.postId, records);
    }

    const results = [];
    for (const postId of postIds) {
        const legacy = await loadLegacyRecord({ legacyVaultRoot, inventoryByPostId, postId });
        const sourceRevisionId = await ensureLegacySourceRevision({ userId, postId, legacySha256: legacy.sha256 });
        const result = await createOrRetryLocalPostCaseFile({
            userId,
            postId,
            sourceRevisionId,
            vaultRoot,
            loadInputs: loadCaseFileInputs,
            historicalImport: {
                title: legacy.title,
                legacyPath: legacy.relativePath,
                sha256: legacy.sha256,
                content: legacy.content
            }
        });
        results.push({ post_id: postId, source_revision_id: sourceRevisionId, outcome: result.outcome, relative_path: result.manifest.relative_path });
    }
    console.log(JSON.stringify({ imported: results.length, results }, null, 2));
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
