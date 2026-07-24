import { isSupabaseConfigured, supabase } from '../../supabaseClient.js';

async function clearDatabase() {
    if (!process.argv.includes('--confirm')) {
        console.error('Refusing to delete data. Re-run with --confirm only after verifying the target Supabase environment.');
        process.exitCode = 2;
        return;
    }

    console.log('Clearing database...');

    if (!isSupabaseConfigured) {
        console.error('Supabase client is not configured.');
        process.exitCode = 1;
        return;
    }

    try {
        // Delete all posts
        // We use a condition that is always true to delete all rows
        // Assuming 'id' is the primary key. If it's int, neq 0 works. If uuid, neq '0000...' works.
        // Let's try to fetch one row to see the ID type or just use a broad condition.
        // Actually, we can just use .not('id', 'is', null) which is safer for any non-null PK.

        const { error } = await supabase
            .from('collection_posts')
            .delete()
            .not('id', 'is', null);

        if (error) {
            console.error('Error clearing posts:', error);
        } else {
            console.log('Successfully cleared all posts.');
        }
    } catch (err) {
        console.error('Exception during clear:', err);
    }
}

clearDatabase();
