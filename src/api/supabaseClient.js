import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
