import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve('.env') }); // Already in server/

import { categoryProcessor } from './services/categoryProcessor.js';
import { supabase } from './supabaseClient.js';

const logStream = fs.createWriteStream(path.resolve('FINAL_DEBUG.log'), { encoding: 'utf8' });
const log = (msg) => { console.log(msg); logStream.write(msg + '\n'); };

log(`[KEYS CHECK] Google Key: ${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'FOUND(len:' + process.env.GOOGLE_GENERATIVE_AI_API_KEY.length + ')' : 'MISSING'}`);
log(`[KEYS CHECK] Minimax Key: ${process.env.MINIMAX_API_KEY ? 'FOUND' : 'MISSING'}`);

async function debugOne() {
    log('=== ONE-CLICK DEBUGGING INVESTIGATION ===');

    try {
        const configs = await categoryProcessor.fetchConfigs();
        log(`[STEP 1] Configs Found: ${configs.length}`);

        const { data: records } = await supabase
            .from('post_analysis')
            .select('id, posts(content)')
            .is('primary_category', null)
            .limit(1);

        if (!records?.[0]) return log('NO PENDING RECORDS');

        const content = records[0].posts?.content || "";
        log(`[STEP 2] Content sample: ${content.substring(0, 50)}...`);

        log('[STEP 3] Calling classification...');
        const category = await categoryProcessor.classify(content, true);

        log(`[STEP 4] Final Category Result: "${category}"`);

    } catch (e) {
        log(`[FATAL ERROR] ${e.message}\n${e.stack}`);
    } finally {
        log('=== END ===');
        logStream.end();
        process.exit(0);
    }
}

debugOne();
