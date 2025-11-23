import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://64.181.223.48:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const isConfigured = supabaseUrl && supabaseKey;

export const supabase = isConfigured
    ? createClient(supabaseUrl, supabaseKey)
    : {
        auth: {
            getUser: () => Promise.resolve({ data: { user: null }, error: null }),
            signInWithOAuth: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
            signOut: () => Promise.resolve({ error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
        },
        from: () => ({
            select: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
                eq: () => Promise.resolve({ data: [], error: null }),
                single: () => Promise.resolve({ data: null, error: null }),
            }),
            insert: () => Promise.resolve({ data: null, error: null }),
            update: () => Promise.resolve({ data: null, error: null }),
            delete: () => Promise.resolve({ data: null, error: null }),
        }),
    };

if (!isConfigured) {
    console.warn('Supabase credentials missing. Running in mock mode. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
}
