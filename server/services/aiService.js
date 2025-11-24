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

                // 1. Prepare Data (New nested structure)
                const mainPost = fullJsonData[0];
                if (!mainPost) throw new Error("No post data found");

                // Extract images from the data
                const images = mainPost.images || [];

                // Construct the user message content with new structure
                const repliesText = mainPost.replies && mainPost.replies.length > 0
                    ? mainPost.replies.map(r => `- ${r.author || 'User'}: ${r.text}`).join('\n')
                    : '(No replies)';

                const content = [
                    {
                        type: "text",
                        text: `Here is the content of a Threads post. Please analyze it according to the system instructions.\n\nPost Text: ${mainPost.main_text}\n\nAuthor: ${mainPost.author || 'Unknown'}\n\nReplies/Comments:\n${repliesText}`
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

    /**
     * Helper: Convert image URL to Base64 data URI
     * @param {string} imageUrl - URL of the image
     * @returns {Promise<string>} - Base64 data URI (e.g., data:image/jpeg;base64,...)
     */
    async imageUrlToBase64(imageUrl) {
        try {
            const response = await fetch(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.threads.net/'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');

            // Detect content type from response headers
            const contentType = response.headers.get('content-type') || 'image/jpeg';

            return `data:${contentType};base64,${base64}`;
        } catch (error) {
            console.error(`[AiService] Failed to convert image to Base64: ${imageUrl}`, error.message);
            return null; // Return null if conversion fails
        }
    }

    /**
     * Remix content with "Internalize & Reframe" logic.
     * @param {object} sourceJson - The full JSON object of the source post
     * @param {Array} sourceImages - Array of image URLs from the source post
     * @param {object} userParams - User defined parameters { style, focus, perspective, model }
     */
    async remixContent(sourceJson, sourceImages, userParams) {
        console.log(`[AiService] Remixing content with model: ${userParams.model || this.currentModel}`);

        if (!this.apiKey) {
            return {
                remixed_content: "API Key missing. Please configure OPENROUTER_API_KEY.",
                image_prompt: "API Key missing."
            };
        }

        const modelToUse = userParams.model || this.currentModel;

        try {
            // 1. Construct System Prompt
            const systemPrompt = `
You are a seasoned Industry Veteran and Thought Leader.
Your task is to take a "Source Post" (provided as a JSON object) and **INTERNALIZE** it, then **RE-EXPRESS** it as a deep, professional insight shared casually.

**Input Data Structure:**
- **Source JSON**: Contains text content (\`main_text\`, \`author\`, \`replies\`).
- **Images**: Visual context provided as attachments.

**Input JSON Fields:**
- \`main_text\`: The core content/insight of the original post.
- \`author\`: The original creator.
- \`replies\`: A list of comments. **Use these to identify what resonated with the audience, find interesting counter-points, or add social proof.**

**The Goal:**
The user wants to share this insight on their personal feed.
It must sound like a **Seasoned Expert** (資深專家) sharing a thought, NOT a beginner learning something new.
The vibe is: **"I've seen this pattern many times, and here's what you need to know."**

**CRITICAL REQUIREMENT:**
**ALL OUTPUT fields MUST BE in Traditional Chinese (繁體中文, Taiwan usage).**

Adhere strictly to the following User Style settings:
- Tone (語氣): ${userParams.style || 'Professional & Casual'} (Calm, Insightful, Conversational)
- Focus (核心領域): ${userParams.focus || 'Auto-detect'}
- Perspective (切入觀點): ${userParams.perspective || 'Industry Observer'}

**Style Guidelines:**
1. **Expert Authority**: You already know this concept inside out. Do NOT say "I just learned..." (最近研究...) or "Wow!" (天啊!). Instead, say "I noticed..." (看到這個...) or "This reminds me..." (這讓我想起...).
2. **No Newbie Language**: STRICTLY FORBIDDEN phrases: "天啊", "筆記一下", "簡單說", "避坑小貼士", "感覺像...".
3. **Conversational but Deep**: Use a tone that suggests experience. E.g., "其實很多人忽略了...", "這才是核心邏輯...".
4. **Calm & Composed**: Use minimal emojis (max 1-2). No "😱" or "✨". Use neutral ones like ☕, 📉, 💡.

**Process:**
1. **Analyze Main Text**: Identify the core concept.
2. **Internalize**: Connect this to broader industry knowledge.
3. **Re-teach with Authority**: Frame the insight as an observation.
   - **Bad Opening**: "天啊！最近發現主力洗盤好可怕！" (Newbie)
   - **Good Opening**: "聊聊主力洗盤。其實這就是心理戰的極致表現。" (Expert)
4. **Visual Creation**: The 'imagePrompt' should describe a *new* image that represents this internalized knowledge. It should be a synthesis of the source image's information and the user's style.


** Output Requirements:**
                You must respond with a JSON object containing two fields:
            1. "remixed_content": The new post content(in Traditional Chinese).It should be standalone and ready to post.
2. "image_prompt": A detailed prompt for an AI image generator(like Midjourney / DALL - E).This prompt must be a ** Visual Reorganization ** of the knowledge point.

** Response Format:**
                ONLY return valid JSON.No markdown fencing around the JSON if possible, or standard markdown code block.
{
                "remixed_content": "...",
                    "image_prompt": "..."
            }
            `;

            // 2. Construct User Message
            const content = [
                {
                    type: "text",
                    text: `Source JSON: \n${JSON.stringify(sourceJson, null, 2)} `
                }
            ];

            // 3. Convert images to Base64 if model supports vision and images exist
            if (sourceImages && sourceImages.length > 0) {
                console.log(`[AiService] Converting ${sourceImages.length} images to Base64...`);

                // Limit to 4 images to avoid token limits
                const imagesToProcess = sourceImages.slice(0, 4);

                for (const url of imagesToProcess) {
                    if (url && url.startsWith('http')) {
                        const base64Image = await this.imageUrlToBase64(url);
                        if (base64Image) {
                            content.push({
                                type: "image_url",
                                image_url: {
                                    url: base64Image // Use Base64 data URI instead of URL
                                }
                            });
                            console.log(`[AiService] ✅ Converted image to Base64`);
                        } else {
                            console.warn(`[AiService] ⚠️ Skipped image(conversion failed): ${url} `);
                        }
                    }
                }
            }

            // 3. Call API with Retry Logic
            const modelsToTry = [modelToUse];
            // Add fallback models if they are different from the requested model
            this.models.forEach(m => {
                if (m !== modelToUse) modelsToTry.push(m);
            });

            let lastError;
            let aiText;

            for (const model of modelsToTry) {
                if (!response.ok) {
                    const errText = await response.text();
                    let errData;
                    try {
                        errData = JSON.parse(errText);
                    } catch (e) {
                        errData = { error: errText || response.statusText };
                    }

                    // If rate limited (429), try next model
                    if (response.status === 429 || (errData.error && errData.error.code === 429)) {
                        console.warn(`[AiService] Rate limit hit for ${model}, trying next model...`);
                        if (!response.ok) {
                            const errText = await response.text();
                            let errData;
                            try {
                                errData = JSON.parse(errText);
                            } catch (e) {
                                errData = { error: errText || response.statusText };
                            }

                            // If rate limited (429), try next model
                            if (response.status === 429 || (errData.error && errData.error.code === 429)) {
                                console.warn(`[AiService] Rate limit hit for ${model}, trying next model...`);
                                lastError = new Error(`Rate limit hit: ${JSON.stringify(errData)}`);
                                continue;
                            }

                            throw new Error(`OpenRouter API Error: ${response.status} - ${JSON.stringify(errData)}`);
                        }

                        const data = await response.json();
                        aiText = data.choices[0].message.content;
                        break; // Success, exit loop

                    } catch (error) {
                        console.error(`[AiService] Error with model ${model}:`, error.message);
                        lastError = error;
                        // If it's not a rate limit error (and not the one we just caught and continued), rethrow
                        if (!error.message.includes('Rate limit')) {
                            if (!error.message.includes('Rate limit')) throw error;
                        }
                    }
                }

                if (!aiText) {
                    throw lastError || new Error("All models failed to remix content.");
                }

                // Parse JSON
                let parsedData;
                try {
                    const jsonMatch = aiText.match(/```json\s*([\s\S]*?)\s*```/) || aiText.match(/```\s*([\s\S]*?)\s*```/);
                    const jsonText = jsonMatch ? jsonMatch[1] : aiText;
                    parsedData = JSON.parse(jsonText.trim());
                } catch (e) {
                    console.warn('Failed to parse JSON, returning raw text');
                    parsedData = {
                        remixed_content: aiText,
                        image_prompt: "Failed to generate specific image prompt."
                    };
                }

                // 4. Generate Image (if prompt exists)
                if (parsedData.image_prompt && parsedData.image_prompt.length > 10) {
                    console.log('[AiService] Generating image from prompt...');
                    const imageUrl = await this.generateImageFromPrompt(parsedData.image_prompt);
                    if (imageUrl) {
                        parsedData.generated_image = imageUrl;
                    }
                }

                return parsedData;

            } catch (error) {
                console.error('[AiService] Remix failed:', error);
                throw error;
            }
        }

    /**
     * Generate an image using OpenRouter (DALL-E 3)
     * @param {string} prompt 
     * @returns {Promise<string|null>} Image URL or null
     */
    async generateImageFromPrompt(prompt) {
            if (!this.apiKey) {
                console.warn('[AiService] OPENROUTER_API_KEY missing. Skipping image generation.');
                return null;
            }

            try {
                console.log('[AiService] Generating image via OpenRouter (DALL-E 3)...');
                const response = await fetch(`${this.baseUrl}/images/generations`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:3000',
                        'X-Title': 'Media Platform Antigravity'
                    },
                    body: JSON.stringify({
                        model: "openai/dall-e-3",
                        prompt: prompt,
                        n: 1,
                        size: "1024x1024",
                        // quality: "standard", // OpenRouter might not support all params, keep it simple
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('[AiService] Image generation failed:', errorData);
                    return null;
                }

                const data = await response.json();
                // OpenRouter /images/generations response format matches OpenAI
                return data.data[0].url;

            } catch (error) {
                console.error('[AiService] Image generation error:', error);
                return null;
            }
        }
    }

    export const aiService = new AiService();
