import { supabase } from './supabaseClient';

export async function authenticatedFetch(input, init = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('請先登入後再使用此功能。');
    }

    return fetch(input, {
        ...init,
        headers: {
            ...(init.headers || {}),
            Authorization: `Bearer ${session.access_token}`
        }
    });
}
