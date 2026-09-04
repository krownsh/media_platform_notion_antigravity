import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function csv(rows, headers) {
    const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return [headers.join(','), ...rows.map(row => headers.map(header => quote(row[header])).join(','))].join('\n') + '\n';
}

function safePathSegment(value, fallback) {
    const normalized = String(value || '')
        .normalize('NFKC')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return normalized || fallback;
}

function proposedVaultPath(post) {
    if (!post?.id) return null;
    const platform = ['instagram', 'facebook', 'twitter', 'threads', 'generic', 'notion', 'youtube', 'github', 'image']
        .includes(String(post.platform || '').toLowerCase())
        ? String(post.platform).toLowerCase()
        : 'generic';
    const date = String(post.posted_at || post.created_at || '').slice(0, 10) || 'unknown-date';
    const title = safePathSegment(post.title, `貼文-${String(post.id).slice(0, 8)}`);
    return `wiki/threads/${platform}/${date}-${title}--${String(post.id).slice(0, 8)}.md`;
}

function reviewRows(containers, postIdsField, details) {
    return containers.flatMap(container => {
        const postIds = container[postIdsField]?.length ? container[postIdsField] : [null];
        return postIds.map(postId => ({
            old_id: container.id,
            old_path: '',
            post_id: postId,
            suggested_target: '',
            proposed_action: details.action(container),
            evidence: details.evidence(container),
            confidence: '0',
            requires_owner_confirmation: 'true'
        }));
    });
}

export async function planAutoContainerMigration(output) {
    const baseline = JSON.parse(await readFile(path.join(output, 'baseline.json'), 'utf8'));
    const collections = reviewRows(baseline.auto_collections || [], 'post_ids', {
        action: row => row.post_count <= 1 ? 'owner_review_unfiled_or_relink' : 'owner_review_canonical_collection',
        evidence: row => `legacy Hermes auto-collection; assigned_post_count=${row.post_count || 0}; no semantic merge inferred`
    });
    const topics = reviewRows(baseline.auto_topics || [], 'source_ids', {
        action: row => row.source_count <= 1 ? 'owner_review_archive_or_relink' : 'owner_review_canonical_topic',
        evidence: row => `legacy agent_auto topic; source_match_count=${row.source_count || 0}; no semantic merge inferred`
    });
    const vault = (baseline.affected_posts || []).map(post => ({
        old_id: '',
        old_path: 'unknown_not_scanned',
        post_id: post.id,
        suggested_target: proposedVaultPath(post),
        proposed_action: 'owner_review_vault_move_after_mapping_approval',
        evidence: 'derived from affected post metadata only; no Vault files read or moved',
        confidence: '0',
        requires_owner_confirmation: 'true'
    }));
    const unresolved = {
        generated_at: new Date().toISOString(),
        read_only: true,
        collections: collections.filter(row => row.requires_owner_confirmation === 'true'),
        topics: topics.filter(row => row.requires_owner_confirmation === 'true'),
        vault,
        note: 'No semantic merge, database update, Vault read, or Vault move was performed.'
    };
    const headers = ['old_id', 'old_path', 'post_id', 'suggested_target', 'proposed_action', 'evidence', 'confidence', 'requires_owner_confirmation'];
    await Promise.all([
        writeFile(path.join(output, 'collection-plan.csv'), csv(collections, headers), 'utf8'),
        writeFile(path.join(output, 'topic-plan.csv'), csv(topics, headers), 'utf8'),
        writeFile(path.join(output, 'vault-plan.csv'), csv(vault, headers), 'utf8'),
        writeFile(path.join(output, 'unresolved.json'), `${JSON.stringify(unresolved, null, 2)}\n`, 'utf8')
    ]);
    return { collections: collections.length, topics: topics.length, unresolved: unresolved.collections.length + unresolved.topics.length };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
    const index = process.argv.indexOf('--output');
    const rawOutput = index >= 0 ? process.argv[index + 1] : process.env.CONTAINER_MIGRATION_OUTPUT;
    if (!rawOutput) throw new Error('Use --output <directory> after the read-only audit.');
    const output = path.resolve(rawOutput);
    planAutoContainerMigration(output).then(result => console.log(JSON.stringify({ ok: true, output, ...result }))).catch(error => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
}
