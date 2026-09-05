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

const AUTO_COLLECTION_TARGETS = new Map([
    ['AI工具', 'agent工具'],
    ['AI 工具', 'agent工具'],
    ['AI 工具与应用', 'agent工具'],
    ['AI 工具與應用', 'agent工具'],
    ['人工智慧', 'agent工具'],
    ['人工智慧工具', 'agent工具'],
    ['AI代理人與自動化開發', 'agent工具'],
    ['AI 程式代理人', 'agent工具'],
    ['AI 工具與工作流', 'agent工具'],
    ['AI 與知識管理', 'agent工具'],
    ['數位工作流與工具', 'agent工具'],
    ['開發工具', '工程師開發優化'],
    ['遊戲開發', '工程師開發優化'],
    ['人工智慧與本機開發', '工程師開發優化'],
    ['人工智慧與資安', '工程師開發優化'],
    ['AI 開發工具', '工程師開發優化'],
    ['前端開發', '工程師開發優化'],
    ['AI 與軟體開發', '工程師開發優化'],
    ['開發與資安', '工程師開發優化'],
    ['AI 與前端開發', '工程師開發優化'],
    ['人工智慧與創作工具', 'ai圖片+影片'],
    ['AI繪圖與視覺創作', 'ai圖片+影片'],
    ['AI內容製作', 'ai圖片+影片'],
    ['AI創作與貼圖設計', 'ai圖片+影片'],
    ['生成式 AI', 'ai圖片+影片'],
    ['金融市場', '投資'],
    ['創業與產品營運', '副業'],
    ['AI與產品策略', '副業'],
    ['產品策略', '副業'],
    ['獨立開發', '副業'],
    ['職涯與遠端工作', '副業'],
    ['教育與校園', '教學']
]);

function ownerTargetFor(autoCollection, ownerCollections) {
    const targetName = AUTO_COLLECTION_TARGETS.get(autoCollection.name);
    if (!targetName) return null;
    return ownerCollections.find(collection => collection.user_id === autoCollection.user_id && collection.name === targetName) || null;
}

function proposedVaultPath(post, target) {
    if (!post?.id) return null;
    const date = String(post.posted_at || post.created_at || '').slice(0, 10) || 'unknown-date';
    const title = safePathSegment(post.title, `貼文-${String(post.id).slice(0, 8)}`);
    const folder = target ? `wiki/collections/${safePathSegment(target.name, '未命名資料夾')}` : 'wiki/inbox';
    return `${folder}/${date}-${title}--${String(post.id).slice(0, 8)}.md`;
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
    const ownerCollections = baseline.owner_collections || [];
    const collectionTargetByPost = new Map();
    const collections = reviewRows(baseline.auto_collections || [], 'post_ids', {
        action: row => ownerTargetFor(row, ownerCollections)
            ? 'owner_review_relink_to_existing_collection'
            : 'owner_review_unfiled',
        evidence: row => {
            const target = ownerTargetFor(row, ownerCollections);
            return target
                ? `legacy Hermes auto-collection; exact closed-map target=${target.name} (${target.id}); assigned_post_count=${row.post_count || 0}`
                : `legacy Hermes auto-collection; no approved owner Collection target for name=${row.name}; keep post unfiled`;
        }
    });
    for (const autoCollection of baseline.auto_collections || []) {
        const target = ownerTargetFor(autoCollection, ownerCollections);
        for (const postId of autoCollection.post_ids || []) collectionTargetByPost.set(postId, target);
    }
    for (const row of collections) {
        const target = collectionTargetByPost.get(row.post_id);
        row.suggested_target = target ? `${target.id}:${target.name}` : '';
        row.confidence = target ? '0.90' : '0';
    }
    const topics = reviewRows(baseline.auto_topics || [], 'source_ids', {
        action: row => row.source_count <= 1 ? 'owner_review_archive_or_relink' : 'owner_review_canonical_topic',
        evidence: row => `legacy agent_auto topic; source_match_count=${row.source_count || 0}; no semantic merge inferred`
    });
    const vault = (baseline.affected_posts || []).map(post => ({
        old_id: '',
        old_path: 'unknown_not_scanned',
        post_id: post.id,
        suggested_target: proposedVaultPath(post, collectionTargetByPost.get(post.id)),
        proposed_action: 'owner_review_vault_move_after_mapping_approval',
        evidence: collectionTargetByPost.get(post.id)
            ? `derived from explicit owner Collection mapping=${collectionTargetByPost.get(post.id).name}; no Vault files read or moved`
            : 'no approved owner Collection mapping; proposed inbox path only; no Vault files read or moved',
        confidence: collectionTargetByPost.get(post.id) ? '0.90' : '0',
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
