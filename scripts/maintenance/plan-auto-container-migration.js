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

const LEGACY_TOPIC_TARGETS = new Map([
    ['Claude Code 工具鏈', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['AI Agent 開發工具與異步工作流', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['AI使用技巧與效率提升', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['LLM 輸出優化與 Prompt 工程', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['Claude Skills 與 AI 開發工具', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['AI 多代理系統與開發工具', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['桌面自動化與 Python 工具', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['AI 工作流設計與技能蒸餾', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['AI 代理協作與 Grok 生態', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['Apple Silicon 本機 LLM 推論與 oMLX', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['Apple Silicon 本地端 LLM、MLX 量化與模型安全對齊', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['個人數位工作流與常用 App', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['受控多代理人 AI 開發工作流', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['AI Agent 團隊協作與組織設計', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['AI 程式代理人', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['Codex 協助 MiniMax H3 本地部署', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['AI 工具與應用', ['github:krownsh/media_platform_notion_antigravity', 'agent_workflow']],
    ['爬蟲工具與 RAG 資料工程', ['github:krownsh/media_platform_notion_antigravity', 'data_crawling']],
    ['AI Agent 局限性與數據獲取策略', ['github:krownsh/media_platform_notion_antigravity', 'data_crawling']],
    ['公開 API 目錄與開發整合資源', ['github:krownsh/media_platform_notion_antigravity', 'data_crawling']],
    ['台灣法律 RAG 與 MCP 檢索工具', ['github:krownsh/media_platform_notion_antigravity', 'knowledge_rag']],
    ['生成式 AI 輔助學習與知識整理', ['github:krownsh/media_platform_notion_antigravity', 'knowledge_rag']],
    ['AI社群經營與自媒體變現', ['github:krownsh/media_platform_notion_antigravity', 'product_growth']],
    ['AI 客服與電商工具', ['github:krownsh/media_platform_notion_antigravity', 'product_growth']],
    ['Side Project 啟動與技能變現', ['github:krownsh/media_platform_notion_antigravity', 'product_growth']],
    ['內容創作自動化與流量增長', ['github:krownsh/media_platform_notion_antigravity', 'product_growth']],
    ['AI 生图工具与小红书运营', ['github:krownsh/media_platform_notion_antigravity', 'product_growth']],
    ['AI 影片製作與內容創作自動化', ['github:krownsh/media_platform_notion_antigravity', 'product_growth']],
    ['AI產品的可複製性與信任型護城河', ['github:krownsh/media_platform_notion_antigravity', 'product_growth']],
    ['產品驗證與分發策略', ['github:krownsh/media_platform_notion_antigravity', 'product_growth']],
    ['獨立開發者的台灣商業登記與金流上架流程', ['github:krownsh/media_platform_notion_antigravity', 'product_growth']],
    ['AI 代理的開源資安技能庫', ['github:krownsh/media_platform_notion_antigravity', 'infrastructure_security']],
    ['雲端部署的密鑰管理與 API Key 安全', ['github:krownsh/media_platform_notion_antigravity', 'infrastructure_security']],
    ['開源工具發現與開發效率', ['github:krownsh/my_full-stack-path-inspector', 'architecture_analysis']],
    ['前端3D與AI驅動開發工具', ['github:krownsh/my_full-stack-path-inspector', 'architecture_analysis']],
    ['AI Coding Agent 與開發者工具', ['github:krownsh/my_full-stack-path-inspector', 'architecture_analysis']],
    ['Coding Agent 工具與開發效率', ['github:krownsh/my_full-stack-path-inspector', 'architecture_analysis']],
    ['Code Review 工具與 AI 開發效率', ['github:krownsh/my_full-stack-path-inspector', 'architecture_analysis']],
    ['代码库可视化与开发效率工具', ['github:krownsh/my_full-stack-path-inspector', 'architecture_analysis']],
    ['AI 輔助遊戲開發工作流', ['github:krownsh/my_full-stack-path-inspector', 'architecture_analysis']],
    ['AI 輔助軟體開發工作流', ['github:krownsh/my_full-stack-path-inspector', 'architecture_analysis']],
    ['React 與 Next.js 開源 UI 元件庫', ['github:krownsh/my_full-stack-path-inspector', 'architecture_analysis']],
    ['AI 網站生成與網頁重建工具', ['github:krownsh/my-chrome-extension-ordering', 'browser_automation']],
    ['AI 輔助電影感 Landing Page 工作流', ['github:krownsh/my-chrome-extension-ordering', 'browser_automation']],
    ['Android 發布自動化與 Agent 友善 CLI', ['github:krownsh/my_hater_react_native', 'mobile_app']],
    ['台指期的跨資產市場訊號判讀', ['github:krownsh/v0-stock-portfolio-dashboard', 'market_data']],
    ['AI 開發代理與金融即時儀表板', ['github:krownsh/v0-stock-portfolio-dashboard', 'market_data']],
    ['設計自動化與 AI 設計工具', ['github:krownsh/My-sticker-book', 'visual_content']],
    ['開源 AI 影片創作工作流', ['github:krownsh/My-sticker-book', 'visual_content']],
    ['AI 生圖控制與視覺提示詞', ['github:krownsh/My-sticker-book', 'visual_content']],
    ['AI 輔助影片剪輯與開源工作流', ['github:krownsh/My-sticker-book', 'visual_content']],
    ['影片自動化與 AI 剪輯工具', ['github:krownsh/My-sticker-book', 'visual_content']],
    ['AI 寵物貼圖生成與 LINE 上架流程', ['github:krownsh/My-sticker-book', 'visual_content']],
    ['以語言模型拆解提示詞並用 Gemini 生成風格化寵物插圖', ['github:krownsh/My-sticker-book', 'visual_content']],
    ['文字驅動 AI 影片剪輯', ['github:krownsh/My-sticker-book', 'visual_content']],
    ['MiniMax H3 的 Claude Code 分鏡 Skill 與對話標籤表演控制', ['github:krownsh/My-sticker-book', 'visual_content']],
    ['iOS App Store 素材自動化', ['github:krownsh/My-sticker-book', 'ios_swiftui']]
]);

function ownerTargetFor(autoCollection, ownerCollections) {
    const targetName = AUTO_COLLECTION_TARGETS.get(autoCollection.name);
    if (!targetName) return null;
    return ownerCollections.find(collection => collection.user_id === autoCollection.user_id && collection.name === targetName) || null;
}

export function topicTargetFor(topic) {
    const target = LEGACY_TOPIC_TARGETS.get(topic.title);
    return target ? { repository_target: target[0], domain_key: target[1] } : null;
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
        action: row => topicTargetFor(row)
            ? 'owner_review_relink_to_project_topic'
            : 'owner_review_archive_unmapped',
        evidence: row => {
            const target = topicTargetFor(row);
            return target
                ? `legacy agent_auto topic; exact migration rule=${target.repository_target}#${target.domain_key}; source_match_count=${row.source_count || 0}`
                : `legacy agent_auto topic; no exact project-first migration rule for title=${row.title}; archive candidate without source deletion`;
        }
    });
    const topicTargetById = new Map((baseline.auto_topics || []).map(topic => [topic.id, topicTargetFor(topic)]));
    for (const row of topics) {
        const target = topicTargetById.get(row.old_id);
        row.suggested_target = target ? `${target.repository_target}#${target.domain_key}` : '';
        row.confidence = target ? '0.75' : '0';
    }
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
