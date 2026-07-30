import fs from 'fs/promises';
import { aiService } from './services/aiService.js';

async function test() {
    try {
        console.log('Reading threads_debug_structure.json...');
        const data = await fs.readFile('threads_debug_structure.json', 'utf-8');
        const json = JSON.parse(data);
        console.log('Loaded JSON data, length:', json.length);

        console.log('Calling analyzeThreadsPost...');
        const result = await aiService.analyzeThreadsPost(json);
        console.log('\n=== Analysis Result ===');
        console.log(result.summary);
        console.log('\n======================');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();
