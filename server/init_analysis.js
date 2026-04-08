
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('server', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function init() {
    console.log('--- INITIALIZING ANALYSIS RECORDS ---');

    // 1. Get all posts
    const { data: posts, error: e1 } = await supabase.from('posts').select('id, user_id');
    if (e1) {
        console.error('Fetch posts failed:', e1.message);
        process.exit(1);
    }

    console.log(`Found ${posts.length} posts. Checking for missing analysis records...`);

    let created = 0;
    for (const post of posts) {
        // 直接 Insert，不指定 onConflict，因為我們剛才已經清空整張表
        const { error: e2 } = await supabase.from('post_analysis').insert({
            post_id: post.id,
            user_id: post.user_id,
            primary_category: null,
            summary: null,
            tags: []
        });

        if (e2) {
            console.error(`[FAIL] Post ${post.id}:`, e2.message);
        } else {
            created++;
        }
    }

    console.log(`Successfully initialized ${created} analysis placeholders.`);
    process.exit(0);
}

init();
