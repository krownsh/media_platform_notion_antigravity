import { supabase } from './server/supabaseClient.js';

async function testConnection() {
    console.log('Testing Supabase connection...');

    try {
        // Test 1: Check if client is configured
        console.log('\n1. Checking Supabase client configuration...');
        // Note: In Node.js environment, import.meta.env is not available directly without setup.
        // This test script might need to load .env manually if run with 'node'.
        // However, since we import 'supabase' from the client file, let's see what it has.
        console.log('Client configured:', !!supabase);

        // Test 2: Try to query posts table
        console.log('\n2. Querying posts table...');
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .limit(5);

        if (error) {
            console.error('Error querying posts:', error);
        } else {
            console.log('Successfully queried posts table');
            console.log('Number of posts:', data?.length || 0);
        }

        // Test 3: Check auth status & Try Login
        console.log('\n3. Checking auth status...');
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (user) {
            console.log('Already logged in as:', user.email);
        } else {
            console.log('Not logged in. Attempting login...');
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: 'bgkong1205@gmail.com',
                password: 'A123123a'
            });

            if (loginError) {
                console.error('❌ Login failed:', loginError.message);
            } else {
                console.log('✅ Login successful! User:', loginData.user.email);
            }
        }

        console.log('\n✅ Connection test completed');

    } catch (error) {
        console.error('\n❌ Connection test failed:', error);
    }
}

testConnection();
