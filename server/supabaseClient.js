import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Try to get from environment variables first, then fallback to frontend credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://64.181.223.48:8000';

// For backend, use service role key to bypass RLS
// Anon key (for frontend): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
// Service role key (for backend - bypasses RLS):
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

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
