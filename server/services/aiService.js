import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { classifyByRules, normalizeCategorySlug } from './categoryRules.js';

dotenv.config();

/**
 * AI Service (Server-side only)
 * Handles interactions with MiniMax for analysis and rewriting.
 */
class AiService {
    constructor() {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // 強制優先讀取伺服器目錄下的環境變數 (不論 CWD 在哪)
        dotenv.config({ path: path.join(__dirname, '..', '.env') });

        this.minimaxApiKey = process.env.MINIMAX_API_KEY?.trim();
        this.minimaxGroupId = process.env.MINIMAX_GROUP_ID?.trim();
        this.baseUrl = 'https://api.minimax.io/v1'; // 換成 .io 試試

        // 徹底過濾無效字元
        if (!this.minimaxGroupId || this.minimaxGroupId.includes('填在這裡') || this.minimaxGroupId.trim() === '') {
            this.minimaxGroupId = null;
        }

        console.log(`[AiService] Minimax Check: Key(len:${this.minimaxApiKey?.length || 0}), GroupId:${this.minimaxGroupId ? 'Valid' : 'None/Ignored'}`);

        // Minimax Models (Official)
        this.freeModels = [
            'minimax-m2.7',
            'MiniMax-Text-01',
        ];
        this.currentFreeModelIndex = 0;
    }

    get currentFreeModel() {
        return this.freeModels[this.currentFreeModelIndex];
    }

    switchToNextFreeModel() {
        this.currentFreeModelIndex = (this.currentFreeModelIndex + 1) % this.freeModels.length;
        console.log(`[AiService] Switching to next model: ${this.currentFreeModel}`);
    }

    /**
     * Analyze a Threads post
     */
    async analyzeThreadsPost(fullJsonData) {
        if (!fullJsonData || !Array.isArray(fullJsonData) || fullJsonData.length === 0) {
            throw new Error('No valid data provided for Threads analysis');
        }
        console.log('[AiService] Analyzing Threads post...');
        const mainPost = fullJsonData[0];
        if (!mainPost) {
            throw new Error('Threads post data is empty');
        }

        const systemPrompt = await this.getSystemPrompt();

        if (!this.minimaxApiKey) {
            throw new Error('MINIMAX_API_KEY is not configured');
        }

        let lastError;
        for (const model of this.freeModels) {
            try {
                return await this.analyzeWithMinimax(mainPost, systemPrompt, model);
            } catch (error) {
                lastError = error;
                console.warn(`[AiService] MiniMax model ${model} failed:`, error.message);
            }
        }

        throw lastError || new Error('MiniMax analysis failed');
    }

    /**
     * Analyze a generic article or post.
     */
    async analyzeGenericPost(contentData) {
        console.log('[AiService] Analyzing Generic post...');
        const systemPrompt = await this.getGenericSystemPrompt();

        if (!this.minimaxApiKey) {
            throw new Error('MINIMAX_API_KEY is not configured');
        }

        let lastError;
        for (const model of this.freeModels) {
            try {
                return await this.analyzeWithMinimax(contentData, systemPrompt, model);
            } catch (error) {
                lastError = error;
                console.warn(`[AiService] MiniMax model ${model} failed:`, error.message);
            }
        }

        throw lastError || new Error('MiniMax analysis failed');
    }

    async getSystemPrompt() {
        try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const promptPath = path.join(__dirname, '..', 'prompts', 'threads_summary_prompt.md');
            let systemPrompt = await fs.readFile(promptPath, 'utf-8');
            systemPrompt += '\n\n**IMPORTANT: You must respond with ONLY valid JSON format.**';
            return systemPrompt;
        } catch (error) {
            return "You are a helpful social media analyst. Summarize in Traditional Chinese. Respond in JSON.";
        }
    }

    async getGenericSystemPrompt() {
        try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const promptPath = path.join(__dirname, '..', 'prompts', 'generic_summary_prompt.md');
            return await fs.readFile(promptPath, 'utf-8');
        } catch (error) {
            return "Restate the content from the author's perspective. Respond in JSON.";
        }
    }

    async analyzeWithMinimax(mainPost, systemPrompt, modelName) {
        console.log(`[AiService] Minimax Analysis: ${modelName}`);
        const repliesText = (mainPost.replies || []).map(r => `- ${r.author || 'User'}: ${r.text}`).join('\n') || '(No replies)';
        const userContent = `Content: ${mainPost.content || mainPost.main_text}\nAuthor: ${mainPost.author || 'Unknown'}\nReplies:\n${repliesText}`;

        const headers = {
            'Authorization': `Bearer ${this.minimaxApiKey}`,
            'Content-Type': 'application/json'
        };

        // 如果有 Group ID 則補上
        if (this.minimaxGroupId) {
            headers['x-group-id'] = this.minimaxGroupId;
        }

        const response = await fetch(`${this.baseUrl}/text/chatcompletion_v2`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: modelName,
                messages: [
                    { role: "system", name: "MiniMax AI", content: systemPrompt },
                    { role: "user", name: "User", content: userContent }
                ],
                temperature: 0.1
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(`Minimax API Error: ${response.status} - ${JSON.stringify(data)}`);

        const aiContent = data.choices?.[0]?.message?.content;
        if (!aiContent) {
            console.warn('[AiService] Minimax returned empty content or no choices');
            throw new Error('AI returned no content');
        }

        return this.parseAiResponse(aiContent, modelName, data, mainPost.content || mainPost.main_text);
    }

    parseAiResponse(aiText, modelName, rawData = null, originalContent = '') {
        let parsedData;
        try {
            let cleanText = aiText.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
            }
            parsedData = JSON.parse(cleanText);
        } catch (e) {
            throw new Error(`MiniMax returned invalid JSON: ${e.message}`);
        }

        if (!parsedData || Array.isArray(parsedData) || typeof parsedData !== 'object') {
            throw new Error('MiniMax response must be a JSON object');
        }

        let primaryCategory = parsedData.primary_category ? normalizeCategorySlug(parsedData.primary_category) : null;
        if (!primaryCategory || primaryCategory === 'other') {
            primaryCategory = classifyByRules(originalContent);
        }

        return {
            summary: parsedData,
            structured: parsedData,
            primary_category: primaryCategory || 'other',
            model: modelName,
            raw: rawData
        };
    }

    async rewriteContent(content, style) {
        console.log(`[AiService] Rewriting: ${style}`);
        try {
            const prompt = `Rewrite the following content in ${style} style. Use Traditional Chinese. Respond in plain text.`;
            const headers = { 'Authorization': `Bearer ${this.minimaxApiKey}`, 'Content-Type': 'application/json' };
            if (this.minimaxGroupId) headers['x-group-id'] = this.minimaxGroupId;

            const response = await fetch(`${this.baseUrl}/text/chatcompletion_v2`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: this.currentFreeModel,
                    messages: [
                        { role: "system", name: "MiniMax AI", content: prompt },
                        { role: "user", name: "User", content: content }
                    ]
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(`Minimax API Error (Rewrite): ${response.status} - ${JSON.stringify(data)}`);
            }
            return data.choices?.[0]?.message?.content || '[ERROR] No content returned';
        } catch (error) {
            console.error('[AiService] Rewrite failed:', error.message);
            return `[ERROR] ${error.message}`;
        }
    }

    async remixContent(sourceJson, sourceImages, userParams) {
        console.log('=== REMIX DEBUG START ===');
        console.log('[AiService] Remixing content...');
        const systemPrompt = `You are an expert. Internalize this: ${JSON.stringify(sourceJson)}. Re-express it in ${userParams.style || 'insightful'} tone. 
Respond ONLY with a JSON object matching this strict schema:
{
    "remixed_content": "The completed markdown formatted rewrite",
    "image_prompt": "A short English phrase for generating a cover image via Stable Diffusion"
}`;
        try {
            // 終極測試組合：1. .io/v1 (國際版), 2. .chat/v1 (標準版), 3. .chat/v1 原生非 OpenAI 版
            const testConfigs = [
                { url: 'https://api.minimax.io/v1/text/chatcompletion_v2', prefix: 'Bearer ' }
            ];

            let lastErr;

            for (const config of testConfigs) {
                try {
                    const headers = {
                        'Authorization': `${config.prefix}${this.minimaxApiKey}`,
                        'Content-Type': 'application/json'
                    };
                    if (this.minimaxGroupId) headers['x-group-id'] = this.minimaxGroupId;

                    const response = await fetch(config.url, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({
                            model: this.currentFreeModel,
                            messages: [
                                { role: "system", name: "MiniMax AI", content: systemPrompt },
                                { role: "user", name: "User", content: "Go." }
                            ]
                        })
                    });

                    const responseText = await response.text();
                    let data;
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) { continue; }

                    if (response.ok) {
                        const aiText = data.choices?.[0]?.message?.content || '';
                        if (aiText) return this.parseRemixData(aiText);
                    }

                    lastErr = new Error(`Minimax API Error (${config.url}): ${response.status} - ${responseText}`);
                    console.warn(`[AiService] Attempt ${config.url} failed: ${response.status}`);

                } catch (e) {
                    lastErr = e;
                }
            }
            throw lastErr;
        } catch (error) {
            throw error;
        }
    }

    parseRemixData(aiText) {
        try {
            const parsed = JSON.parse(aiText.trim());
            if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
                throw new Error('Remix response must be a JSON object');
            }
            return parsed;
        } catch (error) {
            throw new Error(`MiniMax returned invalid remix JSON: ${error.message}`);
        }
    }

    async generateStructuredJSON(systemPrompt, userPrompt) {
        if (!this.minimaxApiKey) {
            throw new Error('MiniMax API key not configured');
        }

        const body = {
            model: this.currentFreeModel,
            messages: [
                { role: 'system', content: `${systemPrompt}\n\n**IMPORTANT: Respond with ONLY a valid JSON object.**` },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3
        };

        const response = await fetch(`${this.baseUrl}/text/chatcompletion_v2`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.minimaxApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`MiniMax HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        const aiText = data.choices?.[0]?.message?.content || '';
        return this.parseRemixData(aiText);
    }
}

export const aiService = new AiService();

export async function generateContentJSON(systemPrompt, userPrompt) {
    return aiService.generateStructuredJSON(systemPrompt, userPrompt);
}
