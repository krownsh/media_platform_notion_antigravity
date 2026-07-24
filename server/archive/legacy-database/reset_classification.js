
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function reset() {
    console.log('--- Resetting All Primary Categories ---');

    // 1. Reset post_analysis table
    const { error: error1 } = await supabase
        .from('post_analysis')
        .update({ primary_category: null })
        .not('id', 'is', null); // 滿足 Supabase 安全限制，必須有篩選條件

    // 2. Reset posts table (the legacy or raw category column)
    const { error: error2 } = await supabase
        .from('posts')
        .update({ category: null })
        .not('id', 'is', null);

    if (error1 || error2) {
        console.error('Reset failed:', error1?.message || error2?.message);
    } else {
        console.log(`Successfully cleared category for ALL records in both tables.`);
    }

    process.exit(0);
}

reset();
