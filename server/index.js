import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { orchestrator } from './services/orchestrator.js';
import { aiService } from './services/aiService.js';
import { socialMediaService } from './services/socialMediaService.js';
import { supabase } from './supabaseClient.js';

dotenv.config({ path: './server/.env' });

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost"

app.use(cors());
app.use(express.json());

// Health Check
app.get('/', (req, res) => {
    res.send('Social Media Platform Backend is running');
});

// Process URL Endpoint
app.post('/api/process', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const result = await orchestrator.processUrl(url);

        // If it's a Threads or Twitter post with full_json, run AI analysis
        if (result.data && result.data.full_json && (result.data.platform === 'threads' || result.data.platform === 'twitter')) {
            console.log('[Server] Running AI analysis for Threads post...');
            try {
                const aiResult = await aiService.analyzeThreadsPost(result.data.full_json);
                result.data.analysis = {
                    summary: aiResult.summary,
                    raw: aiResult.raw
                };
                console.log('[Server] AI analysis completed');
            } catch (aiError) {
                console.warn('[Server] AI analysis failed (continuing without it):', aiError.message);
                result.data.analysis = {
                    summary: '## AI 分析暫時無法使用\n\n' + aiError.message
                };
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error processing URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// Analyze Post Endpoint
app.post('/api/analyze-post', async (req, res) => {
    const { fullJson } = req.body;

    if (!fullJson) {
        return res.status(400).json({ error: 'fullJson data is required' });
    }

    try {
        const result = await aiService.analyzeThreadsPost(fullJson);
        res.json(result);
    } catch (error) {
        console.error('Error analyzing post:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rewrite Content Endpoint
app.post('/api/rewrite', async (req, res) => {
    const { content, style } = req.body;

    if (!content || !style) {
        return res.status(400).json({ error: 'content and style are required' });
    }

    try {
        const result = await aiService.rewriteContent(content, style);
        res.json({ result });
    } catch (error) {
        console.error('Error rewriting content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remix Content Endpoint (New)
// Remix Content Endpoint (New)
app.post('/api/remix', async (req, res) => {
    const { sourceJson, sourceImages, userParams } = req.body;

    if (!sourceJson) {
        return res.status(400).json({ error: 'sourceJson is required' });
    }

    try {
        const result = await aiService.remixContent(sourceJson, sourceImages, userParams || {});
        res.json({ result });
    } catch (error) {
        console.error('Error remixing content:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Available Models Endpoint
app.get('/api/models', async (req, res) => {
    try {
        const models = await aiService.getAvailableModels();
        res.json({ models });
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate Image Endpoint
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    try {
        const imageUrl = await aiService.generateImageFromPrompt(prompt);
        res.json({ imageUrl });
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({ error: error.message });
    }
});

// Image Proxy Endpoint to bypass CORS
app.get('/api/proxy-image', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    try {
        // console.log(`[Proxy] Fetching image: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Referer': 'https://www.threads.net/',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        if (!response.ok) {
            console.error(`[Proxy] Failed to fetch image: ${response.status} ${response.statusText} for URL: ${url}`);
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        // Get the content type from the response
        const contentType = response.headers.get('content-type');

        // Set appropriate headers
        res.setHeader('Content-Type', contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        res.setHeader('Access-Control-Allow-Origin', '*'); // Ensure CORS is allowed for the image itself

        // Pipe the image data
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error(`[Proxy] Error processing image: ${url}`, error.message);
        res.status(500).json({ error: 'Failed to load image' });
    }
});

// Signup Endpoint (Bypass email verification)
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Use admin API to create user with email automatically confirmed
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (error) throw error;

        res.json({ user: data.user });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== Posts API ==========
app.get('/api/posts', async (req, res) => {
    if (!isSupabaseConfigured()) {
        return res.json({ posts: [], collections: [] });
    }

    try {
        // Fetch posts
        const { data: posts, error: postsError } = await supabase
            .from('posts')
            .select(`
                *,
                post_media (*),
                post_comments (*),
                post_analysis (*),
                user_annotations (*)
            `)
            .order('created_at', { ascending: false });

        if (postsError) throw postsError;

        // Fetch collections
        const { data: collections, error: collectionsError } = await supabase
            .from('collections')
            .select('*')
            .order('created_at', { ascending: false });

        if (collectionsError) throw collectionsError;

        // Transform data to match frontend expectations
        const formattedPosts = posts.map(post => ({
            id: post.id,
            dbId: post.id,
            platform: post.platform,
            author: post.author_name,
            authorHandle: post.author_id,
            avatar: post.author_avatar_url,
            content: post.content,
            postedAt: post.posted_at,
            originalUrl: post.original_url,
            createdAt: post.created_at,
            fullJson: post.full_json,
            collectionId: post.collection_id,
            images: post.post_media?.filter(m => m.type === 'image').map(m => m.url) || [],
            comments: post.post_comments?.map(c => ({
                user: c.author_name,
                text: c.content,
                postedAt: c.commented_at
            })) || [],
            annotations: post.user_annotations || [],
            analysis: post.post_analysis?.[0] || null
        }));

        res.json({ posts: formattedPosts, collections: collections || [] });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// ========== Annotations (筆記) API ==========

// Helper function to check if Supabase is configured (including fallback)
const isSupabaseConfigured = () => {
    const url = process.env.VITE_SUPABASE_URL || 'http://64.181.223.48:8000';
    const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
    return url && key;
};

// Get annotations for a post
app.get('/api/posts/:postId/annotations', async (req, res) => {
    const { postId } = req.params;

    if (!postId) {
        return res.status(400).json({ error: 'Post ID is required' });
    }

    if (!isSupabaseConfigured()) {
        console.warn('[Annotations] Supabase not configured, returning empty annotations');
        return res.json({ annotations: [] });
    }

    try {
        const { data, error } = await supabase
            .from('user_annotations')
            .select('*')
            .eq('post_id', postId)
            .eq('type', 'note')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ annotations: data || [] });
    } catch (error) {
        console.error('Error fetching annotations:', error);
        res.status(500).json({ error: 'Failed to fetch annotations' });
    }
});

// Add annotation to a post
app.post('/api/posts/:postId/annotations', async (req, res) => {
    const { postId } = req.params;
    const { content, userId } = req.body;

    if (!postId || !content || !userId) {
        return res.status(400).json({ error: 'Post ID, content, and userId are required' });
    }

    if (!isSupabaseConfigured()) {
        console.warn('[Annotations] Supabase not configured, cannot save annotation');
        return res.status(503).json({
            error: 'Database not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to enable note-taking feature.'
        });
    }

    try {
        const { data, error } = await supabase
            .from('user_annotations')
            .insert({
                post_id: postId,
                user_id: userId,
                content: content,
                type: 'note'
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ annotation: data });
    } catch (error) {
        console.error('Error creating annotation:', error);
        res.status(500).json({ error: 'Failed to create annotation: ' + error.message });
    }
});

// ========== Image Workflow API ==========

// Step 1: Analyze Image
app.post('/api/image-workflow/step1', async (req, res) => {
    const { postId, imageUrl, prompt, userId } = req.body;
    if (!imageUrl || !prompt) return res.status(400).json({ error: 'Image URL and prompt are required' });

    try {
        const output = await aiService.analyzeImageLogic(imageUrl, prompt);

        // Save to DB
        let logId = null;
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('image_workflow_logs')
                .insert({
                    post_id: postId,
                    user_id: userId,
                    step_1_prompt: prompt,
                    step_1_output: output
                })
                .select()
                .single();

            if (!error && data) logId = data.id;
            else console.error('Failed to save workflow log:', error);
        }

        res.json({ output, logId });
    } catch (error) {
        console.error('Step 1 Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Step 2: Rewrite & Translate
app.post('/api/image-workflow/step2', async (req, res) => {
    const { logId, content, prompt } = req.body;
    if (!content || !prompt) return res.status(400).json({ error: 'Content and prompt are required' });

    try {
        const output = await aiService.rewriteAndTranslate(content, prompt);

        // Update DB
        if (logId && isSupabaseConfigured()) {
            await supabase
                .from('image_workflow_logs')
                .update({
                    step_2_prompt: prompt,
                    step_2_output: output
                })
                .eq('id', logId);
        }

        res.json({ output });
    } catch (error) {
        console.error('Step 2 Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Step 3: Generate Image
app.post('/api/image-workflow/step3', async (req, res) => {
    const { logId, prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        console.log('[API] Step 3: Generating Image with Nano Banana Pro...');
        const imageUrl = await aiService.generateImageWithNanoBanana(prompt);

        // Update DB
        if (logId && isSupabaseConfigured()) {
            await supabase
                .from('image_workflow_logs')
                .update({
                    step_3_prompt: prompt,
                    step_3_output: imageUrl
                })
                .eq('id', logId);
        }

        res.json({ output: imageUrl });
    } catch (error) {
        console.error('Step 3 Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Step 4: Publish to Social Media
app.post('/api/publish/instagram', async (req, res) => {
    const { imageUrl, caption } = req.body;
    if (!imageUrl || !caption) return res.status(400).json({ error: 'Image URL and caption are required' });

    try {
        const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
        const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
        const result = await socialMediaService.publishToInstagram(imageUrl, caption, accessToken, accountId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/publish/threads', async (req, res) => {
    const { imageUrl, text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
        const accessToken = process.env.THREADS_ACCESS_TOKEN;
        const userId = process.env.THREADS_USER_ID;
        const result = await socialMediaService.publishToThreads(imageUrl, text, accessToken, userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/publish/twitter', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
        const accessToken = process.env.TWITTER_ACCESS_TOKEN;
        const result = await socialMediaService.publishToTwitter(text, accessToken);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Workflow History for a Post

// Get Workflow History for a Post
app.get('/api/posts/:postId/image-workflows', async (req, res) => {
    const { postId } = req.params;
    if (!isSupabaseConfigured()) return res.json({ logs: [] });

    try {
        const { data, error } = await supabase
            .from('image_workflow_logs')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ logs: data });
    } catch (error) {
        console.error('Error fetching workflow logs:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on ${FRONTEND_URL}:${PORT}`);
});
