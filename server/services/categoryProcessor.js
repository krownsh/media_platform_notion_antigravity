import { normalizeCategorySlug } from './categoryRules.js';
import { aiService } from './aiService.js';
import { supabase } from '../supabaseClient.js';

/**
 * Category Processor
 * Core logic for classifying scraped content, aligning with fieldtheory-cli.
 * 
 * Update: Now dynamic and reads from database category_configs.
 */
class CategoryProcessor {
    constructor() {
        this.configs = null;
        this.lastFetch = 0;
        this.CACHE_TTL = 300000; // 5 minutes cache
    }

    /**
     * fetchConfigs
     * Loads categories from Supabase
     */
    async fetchConfigs() {
        const now = Date.now();
        if (!this.configs || (now - this.lastFetch > this.CACHE_TTL)) {
            console.log('[CategoryProcessor] Refreshing category configurations from DB...');
            const { data, error } = await supabase
                .from('category_configs')
                .select('*')
                .eq('is_active', true);

            if (error) {
                console.error('[CategoryProcessor] Error fetching configs:', error.message);
                return this.configs || []; // Rollback to cache or empty
            }

            this.configs = data || [];
            this.lastFetch = now;
            console.log(`[CategoryProcessor] Loaded ${this.configs.length} active configurations.`);
        }
        return this.configs;
    }

    /**
     * classifyByRules
     * Local rule-based classification using DB patterns
     */
    async classifyByRules(content, configs) {
        if (!content) return 'other';

        for (const config of configs) {
            const patterns = config.patterns || [];
            if (!Array.isArray(patterns)) continue;

            const isMatch = patterns.some(patternStr => {
                try {
                    // Try to construct regex if it looks like one, or use simple includes
                    const regex = new RegExp(patternStr, 'i');
                    return regex.test(content);
                } catch (e) {
                    return content.toLowerCase().includes(patternStr.toLowerCase());
                }
            });

            if (isMatch) return config.slug;
        }
        return 'other';
    }

    /**
     * classify
     * Automatically uses rules and optionally falls back to LLM.
     */
    async classify(content, useLlmFallback = true) {
        if (!content || content.trim() === '') return 'other';

        const configs = await this.fetchConfigs();

        console.log('[CategoryProcessor] Attempting rule-based classification...');
        let category = await this.classifyByRules(content, configs);

        // 2. LLM Fallback if Regex yields unclassified/other
        if (category === 'other' && useLlmFallback) {
            console.log('[CategoryProcessor] Rule-based failed. Falling back to LLM classification...');
            category = await this.classifyWithLLM(content, configs);
        } else {
            console.log(`[CategoryProcessor] Classified via rules: ${category}`);
        }

        return category;
    }

    /**
     * classifyWithLLM
     */
    async classifyWithLLM(content, configs) {
        // Build dynamic prompt from DB configs
        const configLabels = configs.map(c => `- [${c.slug}]: ${c.description || 'General theme'}`).join('\n');

        const prompt = `You are an expert digital content analyst. Your task is to classify the text into exactly ONE of the following categories:
${configLabels}
- [other]: Any content that strictly doesn't fit the themes above.

If the content spans multiple, pick the most dominant one. Avoid "other" unless it's completely unrelated.
Respond with ONLY the lowercase category name.

Text:
${content.substring(0, 500)}`;

        try {
            let aiResponse = 'other';

            // 優先使用 Minimax (依據使用者要求)
            if (aiService.minimaxApiKey) {
                // 直接調用 aiService 的統一部分析方法，確保認證資訊一致
                const aiResult = await aiService.analyzeWithMinimax(
                    { content: content.substring(0, 500) },
                    prompt,
                    aiService.currentFreeModel
                );

                if (aiResult && aiResult.structured) {
                    // LLM 可能在 structured 中回傳分類
                    aiResponse = aiResult.structured.primary_category || aiResult.structured.category || JSON.stringify(aiResult.structured);
                } else if (aiResult && aiResult.summary) {
                    aiResponse = typeof aiResult.summary === 'string' ? aiResult.summary : JSON.stringify(aiResult.summary);
                }
            } else if (aiService.googleApiKey) {
                console.log('[CategoryProcessor] Fallback to Google Gemini (Minimax key missing)...');
                const model = aiService.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const result = await model.generateContent(prompt);
                aiResponse = result.response.text();
            }

            // 動態處理 AI 回應：移除空格與換行，並轉為小寫
            const lowered = aiResponse.toLowerCase();

            // 檢查是否符合資料庫中的任何一個 Slug (採包含匹配，防止 AI 多講話)
            let finalCategory = 'other';
            for (const config of configs) {
                // 如果 AI 回覆中包含了 Slug (例如 "this is ai")，就認領它
                if (lowered.includes(config.slug.toLowerCase())) {
                    finalCategory = config.slug;
                    break;
                }
            }

            console.log(`[CategoryProcessor] AI 回傳: "${aiResponse.trim()}", 最終判定: ${finalCategory}`);
            return finalCategory;

        } catch (error) {
            console.warn('[CategoryProcessor] LLM classification failed:', error.message);
            return 'other';
        }
    }
}

export const categoryProcessor = new CategoryProcessor();
