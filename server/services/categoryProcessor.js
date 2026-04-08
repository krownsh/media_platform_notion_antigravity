import { classifyByRules, normalizeCategorySlug, VALID_CATEGORIES } from './categoryRules.js';
import { aiService } from './aiService.js';

/**
 * Category Processor
 * Core logic for classifying scraped content, aligning with fieldtheory-cli.
 * 
 * Flow:
 * 1. Attempt Regex-based Rule Classification (Fast, zero cost, deterministic).
 * 2. If Regex returns 'other' or fails confident matching, fallback to LLM classification.
 */
class CategoryProcessor {
    /**
     * classify
     * Automatically uses rules and optionally falls back to LLM.
     * @param {string} content - Post text content
     * @param {boolean} useLlmFallback - Whether to call LLM if rules fail
     * @returns {Promise<string>} - The final category slug
     */
    async classify(content, useLlmFallback = true) {
        if (!content || content.trim() === '') return 'other';

        console.log('[CategoryProcessor] Attempting rule-based classification...');
        // 1. Regex Rules
        let category = classifyByRules(content);

        // 2. LLM Fallback if Regex yields unclassified/other
        if (category === 'other' && useLlmFallback) {
            console.log('[CategoryProcessor] Rule-based failed. Falling back to LLM classification...');
            category = await this.classifyWithLLM(content);
        } else {
            console.log(`[CategoryProcessor] Classified via rules: ${category}`);
        }

        return category;
    }

    /**
     * classifyWithLLM
     * Isolated function purely for getting a category tag from LLM.
     */
    async classifyWithLLM(content) {
        const categoryList = Array.from(VALID_CATEGORIES).join(', ');
        const prompt = `You are an expert content classifier. Please classify the following text into exactly ONE of these categories: [${categoryList}].
If it doesn't clearly fit any, use "other".
Respond with ONLY the exact category name in lowercase, nothing else. No punctuation or markdown.

Text:
${content.substring(0, 500)}`; // Trim to save tokens

        try {
            let aiResponse = 'other';

            if (aiService.googleApiKey) {
                const model = aiService.genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });
                const result = await model.generateContent(prompt);
                aiResponse = result.response.text();
            } else if (aiService.minimaxApiKey) {
                const headers = {
                    'Authorization': `Bearer ${aiService.minimaxApiKey}`,
                    'Content-Type': 'application/json'
                };
                if (aiService.minimaxGroupId) headers['x-group-id'] = aiService.minimaxGroupId;

                const response = await fetch(`${aiService.baseUrl}/text/chatcompletion_v2`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        model: aiService.currentFreeModel,
                        messages: [
                            { role: "user", name: "User", content: prompt }
                        ],
                        temperature: 0.1
                    })
                });
                const data = await response.json();
                if (response.ok && data.choices?.length > 0) {
                    aiResponse = data.choices[0].message.content;
                }
            }

            const normalized = normalizeCategorySlug(aiResponse);
            console.log(`[CategoryProcessor] LLM Classified as: ${normalized} (raw: ${aiResponse.trim()})`);
            return normalized;

        } catch (error) {
            console.warn('[CategoryProcessor] LLM classification failed:', error.message);
            return 'other';
        }
    }
}

export const categoryProcessor = new CategoryProcessor();
