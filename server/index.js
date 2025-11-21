import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { orchestrator } from '../src/services/orchestrator.js';

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
        res.json(result);
    } catch (error) {
        console.error('Error processing URL:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
