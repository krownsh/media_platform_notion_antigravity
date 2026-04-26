
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function purge() {
    console.log('--- PURGING ALL CLASSIFICATIONS FROM POSTS TABLE ---');

    const { data, error } = await supabase
        .from('posts')
        .update({
            analysis: null, // 清空核心 JSONB 分類與摘要
            category: null  // 清空原始分類
        })
        .not('id', 'is', null);

    if (error) {
        console.error('Purge failed:', error.message);
    } else {
        console.log('Successfully cleared all analysis data from the main posts table.');
    }

    process.exit(0);
}

purge();
