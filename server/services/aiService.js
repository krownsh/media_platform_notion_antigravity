import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { classifyByRules, normalizeCategorySlug } from './categoryRules.js';

dotenv.config();

/**
 * AI Service (Server-side only)
 * Handles interactions with LLMs via Minimax & Google for analysis.
 */
class AiService {
    constructor() {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // 強制優先讀取伺服器目錄下的環境變數 (不論 CWD 在哪)
        dotenv.config({ path: path.join(__dirname, '..', '.env') });

        this.minimaxApiKey = process.env.MINIMAX_API_KEY?.trim();
        this.minimaxGroupId = process.env.MINIMAX_GROUP_ID?.trim();
        this.googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
        this.baseUrl = 'https://api.minimax.io/v1'; // 換成 .io 試試

        // 徹底過濾無效字元
        if (!this.minimaxGroupId || this.minimaxGroupId.includes('填在這裡') || this.minimaxGroupId.trim() === '') {
            this.minimaxGroupId = null;
        }

        console.log(`[AiService] Minimax Check: Key(len:${this.minimaxApiKey?.length || 0}), GroupId:${this.minimaxGroupId ? 'Valid' : 'None/Ignored'}`);

        // Initialize Google AI
        if (this.googleApiKey) {
            this.genAI = new GoogleGenAI({ apiKey: this.googleApiKey });
        }

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
            console.warn('[AiService] No valid data provided for Threads analysis');
            return this.mockAnalysis();
        }
        console.log('[AiService] Analyzing Threads post...');
        const mainPost = fullJsonData[0];
        if (!mainPost) {
            return this.mockAnalysis();
        }

        const systemPrompt = await this.getSystemPrompt();

        try {
            // 1. Try Minimax (Official API) - User Preference
            try {
                return await this.analyzeWithMinimax(mainPost, systemPrompt, this.currentFreeModel);
            } catch (error) {
                console.warn(`[AiService] Minimax model ${this.currentFreeModel} failed:`, error.message);
                this.switchToNextFreeModel();
                try {
                    return await this.analyzeWithMinimax(mainPost, systemPrompt, this.currentFreeModel);
                } catch (retryError) {
                    console.warn('[AiService] Minimax retry failed, checking Google fallback...');
                }
            }

            // 2. Fallback to Google Gemini
            if (this.googleApiKey) {
                try {
                    return await this.analyzeWithGoogle(mainPost, systemPrompt, 'gemini-1.5-flash');
                } catch (error) {
                    console.warn('[AiService] Google Gemini fallback failed:', error.message);
                }
            }

            // 如果全部嘗試都失敗了且沒有丟出錯誤，也要回傳 mock
            return this.mockAnalysis();
        } catch (finalError) {
            console.error('[AiService] All analysis models failed:', finalError.message);
            return this.mockAnalysis();
        }
    }

    /**
     * Analyze a generic article or post.
     */
    async analyzeGenericPost(contentData) {
        console.log('[AiService] Analyzing Generic post...');
        const systemPrompt = await this.getGenericSystemPrompt();

        if (this.minimaxApiKey) {
            for (const model of this.freeModels) {
                try {
                    return await this.analyzeWithMinimax(contentData, systemPrompt, model);
                } catch (error) {
                    console.warn(`[AiService] Minimax model ${model} failed:`, error.message);
                }
            }
        }

        if (this.googleApiKey) {
            try {
                return await this.analyzeWithGoogle(contentData, systemPrompt, 'gemini-1.5-flash');
            } catch (error) {
                console.warn('[AiService] Google Gemini failed for generic post:', error.message);
            }
        }

        return this.mockAnalysis();
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

    async analyzeWithGoogle(mainPost, systemPrompt, modelName = 'gemini-1.5-flash') {
        console.log(`[AiService] Google Analysis: ${modelName}`);
        const repliesText = (mainPost.replies || []).map(r => `- ${r.author || 'User'}: ${r.text}`).join('\n') || '(No replies)';
        const textPart = `${systemPrompt}\n\nContent: ${mainPost.content || mainPost.main_text}\nAuthor: ${mainPost.author || 'Unknown'}\nReplies:\n${repliesText}`;

        const parts = [{ text: textPart }];
        if (mainPost.images?.length > 0) {
            for (const url of mainPost.images.slice(0, 3)) {
                const base64Data = await this.imageUrlToBase64(url);
                if (base64Data) {
                    parts.push({ inlineData: { data: base64Data.split(',')[1], mimeType: 'image/jpeg' } });
                }
            }
        }

        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({ contents: [{ parts }] });
        const text = result.response.text();
        return this.parseAiResponse(text, `google/${modelName}`, null, mainPost.content || mainPost.main_text);
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
        let parsedData = null;
        try {
            const firstBrace = aiText.indexOf('{');
            const lastBrace = aiText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                parsedData = JSON.parse(aiText.substring(firstBrace, lastBrace + 1));
            } else {
                parsedData = JSON.parse(aiText.trim());
            }
        } catch (e) {
            console.warn('[AiService] JSON Parse failed');
        }

        let primaryCategory = parsedData?.primary_category ? normalizeCategorySlug(parsedData.primary_category) : null;
        if (!primaryCategory || primaryCategory === 'other') {
            primaryCategory = classifyByRules(originalContent);
        }

        return {
            summary: parsedData || aiText,
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
            const match = aiText.match(/{[\s\S]*}/);
            if (match && match[0]) {
                return JSON.parse(match[0]);
            }
        } catch (e) { }
        return { remixed_content: aiText, image_prompt: "N/A" };
    }

    async imageUrlToBase64(imageUrl) {
        try {
            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
        } catch (e) { return null; }
    }

    mockAnalysis() {
        return { summary: "## Mock Data (AI Failed)\nCheck your API settings.", primary_category: 'other' };
    }
}

export const aiService = new AiService();
