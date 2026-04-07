import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

// Try to get from environment variables first
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://64.181.223.48:8000';

// For backend, use service role key to bypass RLS
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase client initialized (Service Role):', supabaseUrl);
} else {
    console.warn('⚠️ Supabase credentials not found. Database features will be disabled.');
    // Create a mock client that returns empty results
    supabase = {
        from: () => ({
            select: () => Promise.resolve({ data: [], error: null }),
            insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
            update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
            delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
        }),
        auth: {
            getUser: () => Promise.resolve({ data: { user: null }, error: null })
        }
    };
}

export { supabase };
