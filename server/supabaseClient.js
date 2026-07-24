import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Try to get from environment variables first
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://64.181.223.48:8000';

// For backend, use service role key to bypass RLS
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey);

let supabase = null;

if (isSupabaseConfigured) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase client initialized (Service Role):', supabaseUrl);
} else {
    console.warn('⚠️ Supabase credentials not found. Database features will be disabled.');
    const mockChain = {
        select: () => mockChain,
        eq: () => mockChain,
        order: () => mockChain,
        single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        then: (resolve) => resolve({ data: [], error: new Error('Supabase not configured') })
    };

    supabase = {
        from: () => ({
            select: () => mockChain,
            insert: () => mockChain,
            update: () => mockChain,
            delete: () => mockChain
        }),
        auth: {
            getUser: () => Promise.resolve({ data: { user: null }, error: null })
        }
    };
}

export { supabase, isSupabaseConfigured };
