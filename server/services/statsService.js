/**
 * statsService.js
 * 聚合服務：多維度統計查詢，對齊 fieldtheory-cli 的 queryVizData 函式設計。
 * 所有查詢均以 userId 為邊界，確保用戶資料隔離。
 */

import { supabase } from '../supabaseClient.js';

/**
 * getCategoryStats
 * 各主分類的貼文數量統計（對齊 fieldtheory-cli 的 GROUP BY primary_category）
 * @param {string} userId
 * @returns {Promise<Array<{primary_category: string, count: number}>>}
 */
export async function getCategoryStats(userId) {
    const { data, error } = await supabase
        .from('post_analysis')
        .select('primary_category, count:id')
        .eq('user_id', userId)
        .not('primary_category', 'is', null);

    if (error) throw new Error(`getCategoryStats: ${error.message}`);

    // 用 JS 做 GROUP BY 聚合（Supabase free tier 不支援 rpc group by）
    const grouped = {};
    for (const row of data || []) {
        const cat = row.primary_category || 'other';
        grouped[cat] = (grouped[cat] || 0) + 1;
    }

    return Object.entries(grouped)
        .map(([primary_category, count]) => ({ primary_category, count }))
        .sort((a, b) => b.count - a.count);
}

/**
 * getDailyTrend
 * 按天統計貼文採集量，用於趨勢折線圖（對齊 fieldtheory-cli 的時間分組）
 * @param {string} userId
 * @param {number} days - 查詢最近幾天
 * @returns {Promise<Array<{date: string, count: number}>>}
 */
export async function getDailyTrend(userId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
        .from('posts')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

    if (error) throw new Error(`getDailyTrend: ${error.message}`);

    // Group by date (YYYY-MM-DD)
    const grouped = {};
    for (const row of data || []) {
        const date = row.created_at.substring(0, 10);
        grouped[date] = (grouped[date] || 0) + 1;
    }

    // Fill in missing dates with 0
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().substring(0, 10);
        result.push({ date: dateStr, count: grouped[dateStr] || 0 });
    }

    return result;
}

/**
 * getDomainLeaderboard
 * 熱門 Domain 排行（對齊 fieldtheory-cli 的 Domain Frequency 分析）
 * 統計 source_domains JSONB 陣列中各 hostname 的出現頻率
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array<{domain: string, count: number}>>}
 */
export async function getDomainLeaderboard(userId, limit = 10) {
    const { data, error } = await supabase
        .from('posts')
        .select('source_domains')
        .eq('user_id', userId)
        .not('source_domains', 'eq', '[]');

    if (error) throw new Error(`getDomainLeaderboard: ${error.message}`);

    // In-memory aggregation（對齊 fieldtheory-cli 的 Map<string, number> 設計）
    const domainMap = new Map();
    for (const row of data || []) {
        const domains = Array.isArray(row.source_domains) ? row.source_domains : [];
        for (const domain of domains) {
            if (domain && typeof domain === 'string') {
                domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
            }
        }
    }

    return Array.from(domainMap.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * getAuthorStats
 * 高頻作者統計 - Rising Voices（對齊 fieldtheory-cli 的 HAVING c >= 3 邏輯）
 * @param {string} userId
 * @param {number} minCount - 最少出現次數
 * @returns {Promise<Array<{author: string, authorHandle: string, count: number, platform: string}>>}
 */
export async function getAuthorStats(userId, minCount = 2) {
    const { data, error } = await supabase
        .from('posts')
        .select('author_name, author_id, platform')
        .eq('user_id', userId)
        .not('author_name', 'is', null);

    if (error) throw new Error(`getAuthorStats: ${error.message}`);

    // Group by author
    const grouped = {};
    for (const row of data || []) {
        const key = row.author_id || row.author_name;
        if (!key) continue;
        if (!grouped[key]) {
            grouped[key] = { author: row.author_name, authorHandle: row.author_id, platform: row.platform, count: 0 };
        }
        grouped[key].count++;
    }

    return Object.values(grouped)
        .filter((a) => a.count >= minCount)
        .sort((a, b) => b.count - a.count);
}

/**
 * getTagCloud
 * Tag 頻率統計（對齊 fieldtheory-cli 的 Slug Tags 聚合）
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array<{tag: string, count: number}>>}
 */
export async function getTagCloud(userId, limit = 20) {
    const { data, error } = await supabase
        .from('post_analysis')
        .select('tags')
        .eq('user_id', userId)
        .not('tags', 'is', null);

    if (error) throw new Error(`getTagCloud: ${error.message}`);

    const tagMap = new Map();
    for (const row of data || []) {
        const tags = Array.isArray(row.tags) ? row.tags : [];
        for (const tag of tags) {
            if (tag && typeof tag === 'string') {
                const normalized = tag.toLowerCase().trim();
                tagMap.set(normalized, (tagMap.get(normalized) || 0) + 1);
            }
        }
    }

    return Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * getOverview
 * 快速總覽：彙整所有關鍵指標
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getOverview(userId) {
    const [totalPosts, totalAnalyzed, categories, topDomains] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('post_analysis').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('primary_category', 'is', null),
        getCategoryStats(userId),
        getDomainLeaderboard(userId, 3),
    ]);

    return {
        total_posts: totalPosts.count || 0,
        total_analyzed: totalAnalyzed.count || 0,
        top_category: categories[0] || null,
        top_domains: topDomains,
        category_breakdown: categories.slice(0, 5),
    };
}
