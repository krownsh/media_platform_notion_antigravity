import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AI Service (Server-side only)
 * Handles interactions with LLMs via OpenRouter for analysis.
 */
class AiService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY;
        this.baseUrl = 'https://openrouter.ai/api/v1';

        // Free models with fallback options
        this.models = [
            'google/gemini-2.0-flash-exp:free',
            'meta-llama/llama-3.2-3b-instruct:free',
            'qwen/qwen-2-7b-instruct:free',
            'microsoft/phi-3-mini-128k-instruct:free'
        ];
        this.currentModelIndex = 0;
    }

    get currentModel() {
        return this.models[this.currentModelIndex];
    }

    switchToNextModel() {
        this.currentModelIndex = (this.currentModelIndex + 1) % this.models.length;
        console.log(`[AiService] Switching to model: ${this.currentModel}`);
    }

    /**
     * Analyze a Threads post using OpenRouter.
     * @param {Array} fullJsonData - The full JSON array from the crawler
     * @returns {Promise<object>} - Analysis result
     */
    async analyzeThreadsPost(fullJsonData) {
        console.log('[AiService] Analyzing Threads post with OpenRouter...');

        if (!this.apiKey) {
            console.warn('[AiService] OPENROUTER_API_KEY is missing. Returning mock data.');
            return this.mockAnalysis();
        }

        // Try up to all available models
        for (let attempt = 0; attempt < this.models.length; attempt++) {
            try {
                console.log(`[AiService] Attempt ${attempt + 1}/${this.models.length} using model: ${this.currentModel}`);

                // 1. Prepare Data
                const mainPost = fullJsonData[0];
                if (!mainPost) throw new Error("No post data found");

                // Extract images from the data
                const images = mainPost.images || [];

                // Construct the user message content
                const content = [
                    {
                        type: "text",
                        text: `Here is the content of a Threads post. Please analyze it according to the system instructions.\n\nPost Text: ${mainPost.text}\n\nAuthor: ${mainPost.author || 'Unknown'}\n\nContext (Comments/Replies):\n${fullJsonData.slice(1).map(i => `- ${i.author || 'User'}: ${i.text}`).join('\n')}`
                    }
                ];

                // Add images to the content (limit to 3) - only for vision-capable models
                if (this.currentModel.includes('gemini')) {
                    images.slice(0, 3).forEach(url => {
                        if (url && url.startsWith('http')) {
                            content.push({
                                type: "image_url",
                                image_url: {
                                    url: url
                                }
                            });
                        }
                    });
                }

                // 2. Load System Prompt
                let systemPrompt;
                try {
                    // Use fileURLToPath to properly handle Windows paths
                    const __filename = fileURLToPath(import.meta.url);
                    const __dirname = path.dirname(__filename);
                    const promptPath = path.join(__dirname, '..', 'prompts', 'threads_summary_prompt.md');
                    systemPrompt = await fs.readFile(promptPath, 'utf-8');

                    // Add JSON format requirement
                    systemPrompt += '\n\n**IMPORTANT: You must respond with ONLY valid JSON in the following format, with NO additional text before or after:**\n```json\n{\n  "core_insight": "一句話精華",\n  "key_points": ["要點1", "要點2", "要點3"],\n  "actionable_knowledge": "具體可操作的知識",\n  "tags": ["標籤1", "標籤2", "標籤3"]\n}\n```';
                } catch (error) {
                    console.warn('[AiService] Could not read prompt file:', error.message);
                    systemPrompt = "You are a helpful social media analyst. Summarize the following post in Traditional Chinese.";
                }

                // 3. Call OpenRouter
                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:3000',
                        'X-Title': 'Media Platform Antigravity'
                    },
                    body: JSON.stringify({
                        model: this.currentModel,
                        messages: [
                            {
                                role: "system",
                                content: systemPrompt
                            },
                            {
                                role: "user",
                                content: content
                            }
                        ]
                    })
                });

                const data = await response.json();

                // Check for rate limit error
                if (!response.ok) {
                    if (response.status === 429 || (data.error && data.error.code === 429)) {
                        console.warn(`[AiService] Rate limit hit for ${this.currentModel}, trying next model...`);
                        this.switchToNextModel();
                        continue; // Try next model
                    }
                    throw new Error(`OpenRouter API Error: ${response.status} - ${JSON.stringify(data)}`);
                }

                const aiText = data.choices[0].message.content;

                // Try to parse JSON from the response
                let parsedData = null;
                try {
                    // Remove markdown code blocks if present
                    const jsonMatch = aiText.match(/```json\s*([\s\S]*?)\s*```/) || aiText.match(/```\s*([\s\S]*?)\s*```/);
                    const jsonText = jsonMatch ? jsonMatch[1] : aiText;
                    parsedData = JSON.parse(jsonText.trim());
                } catch (parseError) {
                    console.warn('[AiService] Failed to parse JSON response, using raw text:', parseError.message);
                }

                return {
                    summary: parsedData ? this.formatSummary(parsedData) : aiText,
                    structured: parsedData,
                    model: this.currentModel,
                    raw: data
                };

            } catch (error) {
                console.error(`[AiService] Attempt ${attempt + 1} failed:`, error.message);

                // If it's the last attempt, return error
                if (attempt === this.models.length - 1) {
                    return {
                        summary: "## AI 分析暫時無法使用\n\n所有免費模型都遇到速率限制。請稍後再試，或考慮：\n\n1. 等待幾分鐘後重試\n2. 在 [OpenRouter](https://openrouter.ai/settings/integrations) 新增自己的 API Key 以提高速率限制\n\n**錯誤詳情：** " + error.message,
                        error: error.message
                    };
                }

                // Try next model
                this.switchToNextModel();
            }
        }
    }

    /**
     * Format structured JSON data into Markdown
     * @param {object} data - Structured data from AI
     * @returns {string} - Formatted Markdown
     */
    formatSummary(data) {
        if (!data) return '';

        let markdown = '';

        // Core Insight
        if (data.core_insight) {
            markdown += `## 💡 核心洞察\n\n${data.core_insight}\n\n`;
        }

        // Key Points
        if (data.key_points && Array.isArray(data.key_points)) {
            markdown += `## 📌 關鍵要點\n\n`;
            data.key_points.forEach((point, index) => {
                markdown += `${index + 1}. ${point}\n`;
            });
            markdown += '\n';
        }

        // Actionable Knowledge
        if (data.actionable_knowledge) {
            markdown += `## 🎯 實用知識\n\n${data.actionable_knowledge}\n\n`;
        }

        // Tags
        if (data.tags && Array.isArray(data.tags)) {
            markdown += `## 🏷️ 標籤\n\n`;
            markdown += data.tags.map(tag => `\`${tag}\``).join(' ');
        }

        return markdown.trim();
    }

    mockAnalysis() {
        return {
            summary: "## 貼文主旨\n這是一篇關於...的貼文 (Mock Data)\n\n## 重點整理\n- 重點 1\n- 重點 2\n\n(請設定 OPENROUTER_API_KEY 以啟用真實分析)",
        };
    }

    /**
     * Rewrite content for a specific platform/style.
     * @param {string} content 
     * @param {string} style - 'viral-tweet', 'linkedin-pro', 'ig-caption', 'blog-intro'
     */
    async rewriteContent(content, style) {
        console.log(`[AiService] Rewriting content in style: ${style}`);

        if (!this.apiKey) {
            return `[${style.toUpperCase()}] ${content.substring(0, 50)}... (請設定 OPENROUTER_API_KEY 以啟用 AI 重寫)`;
        }

        try {
            const stylePrompts = {
                'viral-tweet': 'Rewrite this as a viral Twitter/X post. Make it engaging, concise (under 280 chars), and use emojis strategically.',
                'linkedin-pro': 'Rewrite this as a professional LinkedIn post. Make it insightful, add value, and maintain a professional tone.',
                'ig-caption': 'Rewrite this as an Instagram caption. Make it visually descriptive, use relevant hashtags, and engage the audience.',
                'blog-intro': 'Rewrite this as a compelling blog post introduction. Hook the reader and set up the main points.'
            };

            const prompt = stylePrompts[style] || stylePrompts['viral-tweet'];

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Media Platform Antigravity'
                },
                body: JSON.stringify({
                    model: this.currentModel,
                    messages: [
                        {
                            role: "system",
                            content: prompt
                        },
                        {
                            role: "user",
                            content: content
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`OpenRouter API Error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            console.error('[AiService] Rewrite failed:', error);
            return `[ERROR] Failed to rewrite: ${error.message}`;
        }
    }
}

export const aiService = new AiService();
