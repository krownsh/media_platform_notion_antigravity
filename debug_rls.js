import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// 使用 Service Role Key (繞過 RLS)
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 使用 Anon Key (模擬前端)
const supabaseAnon = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkData() {
    console.log('--- Debugging RLS Issues ---');

    // 1. 使用 Admin Client 查詢 (應該能看到所有資料)
    console.log('\n1. Querying with Service Role Key (Admin)...');
    const { data: adminData, error: adminError } = await supabaseAdmin
        .from('posts')
        .select('id, user_id, content');

    if (adminError) {
        console.error('Admin Query Error:', adminError);
    } else {
        console.log(`Admin found ${adminData.length} posts.`);
        if (adminData.length > 0) {
            console.log('Sample Post User ID:', adminData[0].user_id);
        }
    }

    // 2. 模擬前端登入並查詢
    console.log('\n2. Querying as Authenticated User (bgkong1205@gmail.com)...');

    // 先登入
    const { data: authData, error: loginError } = await supabaseAnon.auth.signInWithPassword({
        email: 'bgkong1205@gmail.com',
        password: 'A123123a'
    });

    if (loginError) {
        console.error('Login Failed:', loginError.message);
        return;
    }

    const userId = authData.user.id;
    console.log('Logged in User ID:', userId);

    // 查詢
    const { data: userData, error: userError } = await supabaseAnon
        .from('posts')
        .select('id, user_id, content');

    if (userError) {
        console.error('User Query Error:', userError);
    } else {
        console.log(`User found ${userData.length} posts.`);
    }

    // 3. 比較 User ID
    if (adminData.length > 0) {
        const postUserId = adminData[0].user_id;
        console.log('\n--- Analysis ---');
        console.log(`Post Creator ID: ${postUserId}`);
        console.log(`Current User ID: ${userId}`);

        if (postUserId !== userId) {
            console.warn('⚠️ MISMATCH: The posts belong to a different user!');
            console.warn('Current RLS policy only allows users to view their OWN posts.');
            console.warn('You need to update RLS policy or update the posts to belong to this user.');
        } else {
            console.log('✅ IDs match. You should be able to see the posts.');
        }
    }
}

checkData();
