
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('server', '.env') });

// 優先使用 Service Role Key 來繞過 RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function absolutePurge() {
    console.log('--- ABSOLUTE PURGE STARTING (BYPASSING RLS) ---');
    console.log('URL:', supabaseUrl);

    // 1. Clear post_analysis (The source of stats)
    console.log('Deleting from post_analysis...');
    const { count, error: e1 } = await supabase
        .from('post_analysis')
        .delete({ count: 'exact' })
        .not('id', 'is', null);

    console.log('Deleted rows in post_analysis:', count ?? 0);

    // 2. Clear posts.analysis column
    console.log('Updating posts table...');
    const { error: e2 } = await supabase
        .from('posts')
        .update({ analysis: null, category: null })
        .not('id', 'is', null);

    if (e1 || e2) {
        console.error('Purge error:', e1?.message || e2?.message);
    } else {
        console.log('Successfully wiped all classification data from database.');
    }

    // Verify results
    const { count: finalCount } = await supabase
        .from('post_analysis')
        .select('*', { count: 'exact', head: true });

    console.log('Final Row Count in post_analysis:', finalCount || 0);

    process.exit(0);
}

absolutePurge();
