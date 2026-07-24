
import { categoryProcessor } from './services/categoryProcessor.js';
import { supabase } from './supabaseClient.js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('server', '.env') });

async function debugOne() {
    console.log('=== ONE-CLICK DEBUGGING INVESTIGATION ===');

    // 1. Check configs
    const configs = await categoryProcessor.fetchConfigs();
    console.log(`[DEBUG] Step 1: Active Configs Loaded: ${configs.length}`);
    if (configs.length > 0) {
        console.log(`[DEBUG] - First Category in list: ${configs[0].slug} (${configs[0].is_active})`);
    }

    // 2. Fetch one unanalyzed record
    const { data: records, error } = await supabase
        .from('post_analysis')
        .select('id, post_id, summary, posts(content, full_json)')
        .is('primary_category', null)
        .limit(1);

    if (error || !records || records.length === 0) {
        console.warn('No unanalyzed records found or error:', error?.message);
        return;
    }

    const record = records[0];
    const content = record.posts?.content || "No content found";
    console.log(`[DEBUG] Step 2: Sample Post Found: ${record.id}`);
    console.log(`[DEBUG] Content snippet: "${content.substring(0, 100)}..."`);

    // 3. Run classification with detailed logging
    console.log(`[DEBUG] Step 3: Running AI classification...`);
    const category = await categoryProcessor.classify(content, true);

    console.log(`[DEBUG] Step 4: Final Decision -> ${category}`);
    console.log('=== INVESTIGATION COMPLETED ===');
    process.exit(0);
}

debugOne();
