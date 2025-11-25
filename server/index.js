import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { orchestrator } from './services/orchestrator.js';
import { aiService } from './services/aiService.js';
import { supabase } from './supabaseClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// Image Proxy Endpoint to bypass CORS
app.get('/api/proxy-image', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.threads.net/',
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        // Get the content type from the response
        const contentType = response.headers.get('content-type');

        // Set appropriate headers
        res.setHeader('Content-Type', contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

        // Pipe the image data
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('Error proxying image:', error);
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
