import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: './server/.env' });

/**
 * AI Service (Server-side only)
 * Handles interactions with LLMs via OpenRouter for analysis.
 */
class AiService {
    constructor() {
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
        this.googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        this.baseUrl = 'https://openrouter.ai/api/v1';

        // Initialize Google AI
        if (this.googleApiKey) {
            this.genAI = new GoogleGenAI({ apiKey: this.googleApiKey });
        }

        // xAI Model (via OpenRouter) - Use Free version if available
        this.xaiModel = 'x-ai/grok-4.1-fast:free';

        // Free models with fallback options (OpenRouter)
        this.freeModels = [
            'x-ai/grok-4.1-fast:free',
            'nvidia/nemotron-nano-12b-v2-vl:free',
            'google/gemini-2.0-flash-exp:free'
        ];
        this.currentFreeModelIndex = 0;
    }

    get currentFreeModel() {
        return this.freeModels[this.currentFreeModelIndex];
    }

    switchToNextFreeModel() {
        this.currentFreeModelIndex = (this.currentFreeModelIndex + 1) % this.freeModels.length;
        console.log(`[AiService] Switching to next free model: ${this.currentFreeModel}`);
    }

    /**
     * Analyze a Threads post using a chain of models:
     * 1. Google Gemini (via Google API)
     * 2. xAI Grok (via OpenRouter)
     * 3. OpenRouter Free Models (Fallback)
     * @param {Array} fullJsonData - The full JSON array from the crawler
     * @returns {Promise<object>} - Analysis result
     */
    async analyzeThreadsPost(fullJsonData) {
        console.log('[AiService] Analyzing Threads post...');

        // 1. Prepare Data
        const mainPost = fullJsonData[0];
        if (!mainPost) throw new Error("No post data found");

        const systemPrompt = await this.getSystemPrompt();

        // Attempt 1: Google Gemini (Direct)
        if (this.googleApiKey) {
            try {
                return await this.analyzeWithGoogle(mainPost, systemPrompt);
            } catch (error) {
                console.warn('[AiService] Google API failed, trying xAI...', error.message);
            }
        } else {
            console.log('[AiService] No Google API Key found, skipping Google Gemini.');
        }

        // Attempt 2: xAI Grok (via OpenRouter)
        if (this.openRouterApiKey) {
            try {
                return await this.analyzeWithOpenRouter(mainPost, systemPrompt, this.xaiModel);
            } catch (error) {
                console.warn('[AiService] xAI failed, trying free models...', error.message);
            }
        }

        // Attempt 3: OpenRouter Free Models (Fallback)
        if (this.openRouterApiKey) {
            for (let i = 0; i < this.freeModels.length; i++) {
                try {
                    return await this.analyzeWithOpenRouter(mainPost, systemPrompt, this.currentFreeModel);
                } catch (error) {
                    console.warn(`[AiService] Free model ${this.currentFreeModel} failed:`, error.message);
                    this.switchToNextFreeModel();
                }
            }
        }

        // All failed
        console.warn('[AiService] All models failed. Returning mock data.');
        return this.mockAnalysis();
    }

    async getSystemPrompt() {
        try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const promptPath = path.join(__dirname, '..', 'prompts', 'threads_summary_prompt.md');
            let systemPrompt = await fs.readFile(promptPath, 'utf-8');

            // Add JSON format requirement
            systemPrompt += '\n\n**IMPORTANT: You must respond with ONLY valid JSON in the following format, with NO additional text before or after:**\n```json\n{\n  "core_insight": "一句話精華",\n  "key_points": ["要點1", "要點2", "要點3"],\n  "actionable_knowledge": "具體可操作的知識",\n  "tags": ["標籤1", "標籤2", "標籤3"]\n}\n```';
            return systemPrompt;
        } catch (error) {
            console.warn('[AiService] Could not read prompt file:', error.message);
            return "You are a helpful social media analyst. Summarize the following post in Traditional Chinese. Respond in JSON.";
        }
    }

    async analyzeWithGoogle(mainPost, systemPrompt) {
        console.log('[AiService] Attempting analysis with Google Gemini (Direct)...');

        const repliesText = mainPost.replies && mainPost.replies.length > 0
            ? mainPost.replies.map(r => `- ${r.author || 'User'}: ${r.text}`).join('\n')
            : '(No replies)';

        const textPart = `
${systemPrompt}

Here is the content of a Threads post:

Post Text: ${mainPost.main_text}
Author: ${mainPost.author || 'Unknown'}
Replies/Comments:
${repliesText}
`;

        const parts = [{ text: textPart }];

        // Add images
        if (mainPost.images && mainPost.images.length > 0) {
            for (const url of mainPost.images.slice(0, 3)) {
                if (url && url.startsWith('http')) {
                    const base64Data = await this.imageUrlToBase64(url);
                    if (base64Data) {
                        // Remove prefix "data:image/jpeg;base64,"
                        const base64Content = base64Data.split(',')[1];
                        // const mimeType = base64Data.split(';')[0].split(':')[1]; // Not strictly needed for new SDK if passing inlineData
                        parts.push({
                            inlineData: {
                                data: base64Content,
                                mimeType: 'image/jpeg' // Defaulting to jpeg, or extract from base64Data
                            }
                        });
                    }
                }
            }
        }

        const response = await this.genAI.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{
                parts: parts
            }]
        });

        // The new SDK response object might not have .response property if it's already the response
        // Or it might need to be accessed differently. 
        // Based on docs, it should be response.text() directly on the result object if it's the high-level response
        // But let's be safe and check structure.

        let text;
        if (typeof response.text === 'function') {
            text = response.text();
        } else if (response.response && typeof response.response.text === 'function') {
            text = response.response.text();
        } else {
            // Fallback for raw candidate access
            text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        return this.parseAiResponse(text, "google/gemini-2.0-flash-exp");
    }

    async analyzeWithOpenRouter(mainPost, systemPrompt, modelName) {
        console.log(`[AiService] Attempting analysis with OpenRouter model: ${modelName}`);

        const repliesText = mainPost.replies && mainPost.replies.length > 0
            ? mainPost.replies.map(r => `- ${r.author || 'User'}: ${r.text}`).join('\n')
            : '(No replies)';

        const content = [
            {
                type: "text",
                text: `Here is the content of a Threads post. Please analyze it according to the system instructions.\n\nPost Text: ${mainPost.main_text}\n\nAuthor: ${mainPost.author || 'Unknown'}\n\nReplies/Comments:\n${repliesText}`
            }
        ];

        // Add images (only for vision capable models)
        // Assuming xAI and Gemini on OpenRouter are vision capable. 
        // Llama 3.2 11b vision is, but 3b might not be. 
        // We'll add images if it's gemini or xai or explicitly vision.
        // For safety, let's try adding them for all, OpenRouter usually handles it or ignores it.
        // Actually, sending images to non-vision models might cause errors.
        const isVision = modelName.includes('gemini') || modelName.includes('xai') || modelName.includes('vision');

        if (isVision && mainPost.images && mainPost.images.length > 0) {
            mainPost.images.slice(0, 3).forEach(url => {
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

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openRouterApiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
                'X-Title': 'Media Platform Antigravity'
            },
            body: JSON.stringify({
                model: modelName,
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

        if (!response.ok) {
            if (response.status === 429 || (data.error && data.error.code === 429)) {
                throw new Error(`Rate limit hit for ${modelName}`);
            }
            throw new Error(`OpenRouter API Error: ${response.status} - ${JSON.stringify(data)}`);
        }

        const aiText = data.choices[0].message.content;
        return this.parseAiResponse(aiText, modelName, data);
    }

    parseAiResponse(aiText, modelName, rawData = null) {
        let parsedData = null;
        try {
            const firstBrace = aiText.indexOf('{');
            const lastBrace = aiText.lastIndexOf('}');

            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const jsonText = aiText.substring(firstBrace, lastBrace + 1);
                parsedData = JSON.parse(jsonText);
            } else {
                const jsonMatch = aiText.match(/```json\s*([\s\S]*?)\s*```/) || aiText.match(/```\s*([\s\S]*?)\s*```/);
                const jsonText = jsonMatch ? jsonMatch[1] : aiText;
                parsedData = JSON.parse(jsonText.trim());
            }
        } catch (parseError) {
            console.warn('[AiService] Failed to parse JSON response, using raw text:', parseError.message);
        }

        return {
            summary: parsedData || aiText, // Return object if parsed, else raw string
            structured: parsedData,
            model: modelName,
            raw: rawData
        };
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

        if (!this.openRouterApiKey) {
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
                    'Authorization': `Bearer ${this.openRouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Media Platform Antigravity'
                },
                body: JSON.stringify({
                    model: this.currentFreeModel,
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
        console.log(`[AiService] Remixing content with model: ${userParams.model || this.currentFreeModel}`);

        if (!this.openRouterApiKey) {
            return {
                remixed_content: "API Key missing. Please configure OPENROUTER_API_KEY.",
                image_prompt: "API Key missing."
            };
        }

        const modelToUse = userParams.model || this.currentFreeModel;

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
            this.freeModels.forEach(m => {
                if (m !== modelToUse) modelsToTry.push(m);
            });

            let lastError;
            let aiText;

            for (const model of modelsToTry) {
                try {
                    console.log(`[AiService] Trying model: ${model}`);

                    const response = await fetch(`${this.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.openRouterApiKey}`,
                            'Content-Type': 'application/json',
                            'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
                            'X-Title': 'Media Platform Antigravity'
                        },
                        body: JSON.stringify({
                            model: model,
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
                    // If it's not a rate limit error, rethrow
                    if (!error.message.includes('Rate limit')) {
                        throw error;
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
        if (!this.openRouterApiKey) {
            console.warn('[AiService] OPENROUTER_API_KEY missing. Skipping image generation.');
            return null;
        }

        try {
            console.log('[AiService] Generating image via OpenRouter (DALL-E 3)...');
            const response = await fetch(`${this.baseUrl}/images/generations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openRouterApiKey}`,
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
