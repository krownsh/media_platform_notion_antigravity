const TOPIC_DOMAINS = [
    { key: 'agent_workflow', label: 'Agent 工作流' },
    { key: 'knowledge_rag', label: '知識／RAG' },
    { key: 'data_crawling', label: '資料擷取／爬蟲' },
    { key: 'architecture_analysis', label: '架構分析／程式碼智慧' },
    { key: 'browser_automation', label: '瀏覽器自動化' },
    { key: 'mobile_app', label: '行動 App 開發' },
    { key: 'ios_swiftui', label: 'iOS／SwiftUI' },
    { key: 'market_data', label: '市場資料' },
    { key: 'portfolio_analysis', label: '投資組合／技術分析' },
    { key: 'visual_content', label: '視覺／貼紙內容' },
    { key: 'product_growth', label: '產品成長' },
    { key: 'infrastructure_security', label: '基礎設施／安全' }
];

export const TOPIC_DOMAIN_KEYS = new Set(TOPIC_DOMAINS.map((domain) => domain.key));
export const TOPIC_DOMAIN_OPTIONS = TOPIC_DOMAINS;

export function normalizeTopicDomain(value) {
    const domain = String(value || '').trim().toLowerCase();
    return TOPIC_DOMAIN_KEYS.has(domain) ? domain : null;
}

export function normalizeProjectTarget(value) {
    const target = String(value || '').trim().toLowerCase();
    return /^github:[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(target) ? target : null;
}

// A source is allowed to drive downstream work only after a user-owned topic
// has an explicitly accepted match. Existing agent_auto rows never qualify.
export async function getAcceptedTopicsForSource(post, supabaseClient) {
    if (!post?.id || !post?.user_id || !supabaseClient) return [];
    const { data, error } = await supabaseClient
        .from('collection_topic_source_matches')
        .select(`
            id, topic_id, source_id, status, score, rationale,
            collection_topics!inner (id, title, slug, origin, status)
        `)
        .eq('user_id', post.user_id)
        .eq('source_id', post.id)
        .eq('status', 'accepted');
    if (error) throw new Error(`Accepted topic lookup failed: ${error.message}`);

    return (data || []).filter((match) => {
        const topic = Array.isArray(match.collection_topics)
            ? match.collection_topics[0]
            : match.collection_topics;
        return topic?.origin === 'user' && topic?.status === 'active';
    }).map((match) => ({
        ...match,
        topic: Array.isArray(match.collection_topics) ? match.collection_topics[0] : match.collection_topics
    }));
}
