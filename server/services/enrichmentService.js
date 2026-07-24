import fetch from 'node-fetch'; // Requires node-fetch if Node < 18, but Node 20 has built-in fetch. We use native fetch.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.resolve(__dirname, '../../sandbox/.enrichment_cache.json');

/**
 * Helper to get/set cache to avoid wasting API credits.
 */
function getCache(postId) {
    if (!fs.existsSync(CACHE_FILE)) return null;
    try {
        const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        return cache[postId] || null;
    } catch {
        return null;
    }
}

function setCache(postId, data) {
    let cache = {};
    if (fs.existsSync(CACHE_FILE)) {
        try {
            cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        } catch {}
    }
    cache[postId] = data;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

/**
 * Enrichment Service
 * Uses Tavily API to fetch deep context for a given query (Keywords).
 */
export async function enrichContext(postData) {
    const postId = postData.id;
    
    // 1. Check local cache to prevent burning credits on repeated runs!
    const cachedData = getCache(postId);
    if (cachedData) {
        console.log('✅ [Enrichment] Loaded from local cache (API credits saved!)');
        return cachedData;
    }

    // 2. Extract keywords. Try to use analysis data first, then fallback to postData
    const analysis = Array.isArray(postData.collection_post_analysis) ? postData.collection_post_analysis[0] : postData.collection_post_analysis;
    let summaryData = {};
    if (analysis && analysis.summary) {
        try {
            summaryData = typeof analysis.summary === 'string' ? JSON.parse(analysis.summary) : analysis.summary;
        } catch(e) {}
    }

    const title = postData.title || summaryData.core_insight || '';
    const tags = (summaryData.tags || postData.tags || []).join(' ');
    
    // We want a highly targeted search query based on the core topic
    const query = `${title} ${tags} official github best practices`.substring(0, 150).trim();
    if (!query) {
        return "No sufficient keywords for enrichment.";
    }

    console.log(`[Enrichment] Querying Tavily for: "${query}"...`);

    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
        console.warn('⚠️ [Enrichment] TAVILY_API_KEY is not set. Skipping enrichment.');
        return "Tavily API Key missing.";
    }

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: tavilyKey,
                query: query,
                search_depth: 'basic',
                include_answer: true,
                max_results: 3
            })
        });

        if (!response.ok) {
            throw new Error(`Tavily HTTP error: ${response.status}`);
        }

        const data = await response.json();
        
        let markdownReport = `### Tavily AI Answer\n${data.answer || 'No direct answer.'}\n\n### Top Sources\n`;
        if (data.results && data.results.length > 0) {
            data.results.forEach((res, i) => {
                markdownReport += `${i + 1}. [${res.title}](${res.url})\n   - ${res.content}\n`;
            });
        } else {
            markdownReport += "No sources found.\n";
        }

        // Cache the result to save credits
        setCache(postId, markdownReport);

        return markdownReport;
    } catch (err) {
        console.error('❌ [Enrichment] Failed to fetch from Tavily:', err.message);
        
        // Fallback to SERP API (if needed) could be implemented here.
        // For now, we return the error gracefully so the pipeline doesn't break.
        return `Enrichment failed: ${err.message}`;
    }
}
