/**
 * Read-only collection source statistics.
 *
 * These numbers use captured-source facts and automatic retrieval clues only.
 * A retired AI analysis, candidate, or accepted Topic is never implied as a
 * source classification here.
 */

import { supabase } from '../supabaseClient.js';

function boundedLimit(value, fallback, maximum = 100) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback;
}

export async function getCategoryStats(userId) {
    const { data, error } = await supabase
        .from('collection_posts')
        .select('platform')
        .eq('user_id', userId);
    if (error) throw new Error(`getCategoryStats: ${error.message}`);

    const grouped = new Map();
    for (const row of data || []) {
        const platform = String(row.platform || 'unknown').trim().toLowerCase() || 'unknown';
        grouped.set(platform, (grouped.get(platform) || 0) + 1);
    }
    return Array.from(grouped, ([primary_category, count]) => ({ primary_category, count }))
        .sort((left, right) => right.count - left.count || left.primary_category.localeCompare(right.primary_category));
}

export async function getDailyTrend(userId, days = 30) {
    const safeDays = boundedLimit(days, 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    const { data, error } = await supabase
        .from('collection_posts')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });
    if (error) throw new Error(`getDailyTrend: ${error.message}`);

    const grouped = new Map();
    for (const row of data || []) {
        const date = row.created_at?.slice(0, 10);
        if (date) grouped.set(date, (grouped.get(date) || 0) + 1);
    }
    return Array.from({ length: safeDays }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (safeDays - 1 - index));
        const key = date.toISOString().slice(0, 10);
        return { date: key, count: grouped.get(key) || 0 };
    });
}

export async function getDomainLeaderboard(userId, limit = 10) {
    const { data, error } = await supabase
        .from('collection_posts')
        .select('source_domains')
        .eq('user_id', userId);
    if (error) throw new Error(`getDomainLeaderboard: ${error.message}`);

    const domainMap = new Map();
    for (const row of data || []) {
        const domains = Array.isArray(row.source_domains) ? row.source_domains : [];
        for (const value of domains) {
            const domain = typeof value === 'string' ? value.trim().toLowerCase() : '';
            if (domain) domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
        }
    }
    return Array.from(domainMap, ([domain, count]) => ({ domain, count }))
        .sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain))
        .slice(0, boundedLimit(limit, 10));
}

export async function getAuthorStats(userId, minCount = 2) {
    const { data, error } = await supabase
        .from('collection_posts')
        .select('author_name, author_id, platform')
        .eq('user_id', userId)
        .not('author_name', 'is', null);
    if (error) throw new Error(`getAuthorStats: ${error.message}`);

    const grouped = new Map();
    for (const row of data || []) {
        const key = row.author_id || row.author_name;
        if (!key) continue;
        const item = grouped.get(key) || { author: row.author_name, authorHandle: row.author_id, platform: row.platform, count: 0 };
        item.count += 1;
        grouped.set(key, item);
    }
    return Array.from(grouped.values())
        .filter(item => item.count >= boundedLimit(minCount, 2))
        .sort((left, right) => right.count - left.count || String(left.author || '').localeCompare(String(right.author || '')));
}

export async function getTagCloud(userId, limit = 20) {
    const { data, error } = await supabase
        .from('owner_post_retrieval_terms')
        .select('term')
        .eq('user_id', userId)
        .eq('visibility', 'active');
    if (error) throw new Error(`getTagCloud: ${error.message}`);

    const terms = new Map();
    for (const row of data || []) {
        const term = typeof row.term === 'string' ? row.term.trim() : '';
        if (term) terms.set(term, (terms.get(term) || 0) + 1);
    }
    return Array.from(terms, ([tag, count]) => ({ tag, count }))
        .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
        .slice(0, boundedLimit(limit, 20));
}

export async function getOverview(userId) {
    const [posts, reviewPackets, categories, topDomains] = await Promise.all([
        supabase.from('collection_posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('owner_review_packets').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        getCategoryStats(userId),
        getDomainLeaderboard(userId, 3)
    ]);
    if (posts.error) throw new Error(`getOverview posts: ${posts.error.message}`);
    if (reviewPackets.error) throw new Error(`getOverview review packets: ${reviewPackets.error.message}`);
    return {
        total_posts: posts.count || 0,
        total_analyzed: reviewPackets.count || 0,
        top_category: categories[0] || null,
        top_domains: topDomains,
        category_breakdown: categories.slice(0, 5)
    };
}
