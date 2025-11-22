import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { orchestrator } from '../src/services/orchestrator.js';
import { aiService } from './services/aiService.js';

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

        // If it's a Threads post with full_json, run AI analysis
        if (result.data && result.data.full_json && result.data.platform === 'threads') {
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
