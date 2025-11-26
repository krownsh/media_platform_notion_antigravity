import { supabase } from '../supabaseClient.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function clearDatabase() {
    console.log('Clearing database...');

    // Check if supabase is initialized
    if (!supabase || !supabase.from) {
        console.error('Supabase client not initialized properly.');
        return;
    }

    try {
        // Delete all posts
        // We use a condition that is always true to delete all rows
        // Assuming 'id' is the primary key. If it's int, neq 0 works. If uuid, neq '0000...' works.
        // Let's try to fetch one row to see the ID type or just use a broad condition.
        // Actually, we can just use .not('id', 'is', null) which is safer for any non-null PK.

        const { error } = await supabase
            .from('posts')
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
