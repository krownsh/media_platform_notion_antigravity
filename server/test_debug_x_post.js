
import { orchestrator } from './services/orchestrator.js';
import { aiService } from './services/aiService.js';
import dotenv from 'dotenv';
dotenv.config();

async function debugXPost() {
    const url = 'https://x.com/ZeroZ_JQ/status/2037516812641034504';
    console.log('=== DEBUGGING X POST ===');

    try {
        const result = await orchestrator.processUrl(url);
        console.log('[1] Orchestrator Result Platform:', result.data.platform);
        console.log('[2] Content Length:', result.data.content?.length || 0);

        if (result.data) {
            const platform = result.data.platform;
            const isSocial = platform === 'threads' || platform === 'twitter';

            if (isSocial && result.data.full_json) {
                console.log('[3] Calling analyzeThreadsPost...');
                try {
                    const aiResult = await aiService.analyzeThreadsPost(result.data.full_json);
                    console.log('[4] AI Result Summary:', aiResult ? 'FOUND' : 'NULL/UNDEFINED');
                    if (aiResult) {
                        console.log('[5] AI Summary Start:', aiResult.summary?.substring(0, 100));
                    }
                } catch (e) {
                    console.error('[!] AI Analysis Failed:', e.message);
                }
            } else {
                console.log('[3] Skipped AI because isSocial or full_json is false');
            }
        }
    } catch (error) {
        console.error('Error during debug:', error);
    }
}

debugXPost();
