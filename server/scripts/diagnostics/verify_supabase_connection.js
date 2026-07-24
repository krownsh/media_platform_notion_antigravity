import { isSupabaseConfigured, supabase } from '../../supabaseClient.js';

async function testConnection() {
    console.log('Testing server-side Supabase connection...');

    try {
        if (!isSupabaseConfigured) {
            throw new Error('Missing SUPABASE_URL and SUPABASE_SECRET_KEY, SUPABASE_SERVICE_KEY, or SUPABASE_SERVICE_ROLE_KEY in server/.env');
        }

        // This is a read-only schema/connectivity check. It never performs an
        // interactive sign-in and contains no credentials.
        const { count, error } = await supabase
            .from('collection_posts')
            .select('*', { count: 'exact', head: true });

        if (error) {
            throw error;
        }

        console.log(`✅ Connection and collection_posts access verified (rows: ${count ?? 'unknown'})`);

    } catch (error) {
        console.error('\n❌ Connection test failed:', error.message);
        process.exitCode = 1;
    }
}

testConnection();
