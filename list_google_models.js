
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './server/.env' });

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
    console.error('GOOGLE_GENERATIVE_AI_API_KEY not found in .env');
    process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey });

async function listModels() {
    try {
        console.log('Fetching models from Google GenAI...');
        const response = await genAI.models.list();

        let models = [];
        // Iterate over the response if it's iterable
        for await (const model of response) {
            models.push(model);
        }

        console.log(`Found ${models.length} models.`);

        // Filter for text generation models (generateContent)
        const textModels = models.filter(m =>
            m.name.includes('gemini') &&
            !m.name.includes('embedding') &&
            !m.name.includes('audio')
        );

        const fs = await import('fs');
        const output = textModels.map(m => ({
            id: m.name.replace('models/', ''),
            name: m.displayName
        }));
        fs.writeFileSync('models.json', JSON.stringify(output, null, 2));
        console.log('Wrote models to models.json');

    } catch (error) {
        console.error('Error listing models:', error);
    }
}

listModels();
