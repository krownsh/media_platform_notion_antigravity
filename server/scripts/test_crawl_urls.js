import { orchestrator } from '../services/orchestrator.js';
import { supabase } from '../supabaseClient.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const urls = [
    "https://x.com/ilovek8s/status/1988558869820301607?t=j5k9X5ggHawQ2Vtf618KuQ&s=19",
    "https://www.threads.com/@gaile_ry9/post/DQ_7HzQkh3z?xmt=AQF0bgmKW7d6YDvQ-WtHXfxWKX0WJp1WBl32RbO2GWCmqL3hemK2KyJl-XTirW6gU6zBXt4&slof=1",
    "https://www.threads.com/@xiaoba_knowledge/post/DQ_TAlnElrI?xmt=AQF0Q44ihBVptKpJ-BAl3J8HhLdZ0-m9YFziIsqbwHfS5LEzK3JrY8-UZqCrDySvSw5FCg7Q&slof=1",
    "https://www.threads.com/@jjds1991/post/DRBcl_nicT3?xmt=AQF0W2SdWlN5OvzUOe8AzIyYtv2v-PJm7aj4sZo4YucsRQni58__sdQp-dknAvBB3x8P81So&slof=1",
    "https://x.com/yanhua1010/status/1989243464832188708?t=Y8dUyGZAtFixOxeAPPotvg&s=19",
    "https://x.com/artinmemes/status/1989327756371366213?t=qmNeSbCQc4zctTM0Ybfj6g&s=19",
    "https://www.threads.com/@w0955313233/post/DRE83NWEy6J?xmt=AQF0tEBdUhAR_5rEej0skJCKUDTiurlQPl4CrkuZ3t7S99ULpvW_skvd_fCQIrjAPSLnQEPl&slof=1",
    "https://x.com/yanhua1010/status/1989614692403466285?t=pYqbFTTbZe5_SL0L-swdug&s=19",
    "https://www.threads.com/@vvaboss/post/DRHD6LYkQUp?xmt=AQF07H5u7BLw9NCEi_6qilgmsIZYvYhghqn2rDPxxPrv8NjMkvosPJYpEg33u6if2AA9sLHf&slof=1"
];

async function getSystemUserId() {
    // Try to get a user from auth.users
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error || !users || users.length === 0) {
        console.warn('Could not find any users. Using a placeholder UUID if possible, but insert might fail.');
        return '00000000-0000-0000-0000-000000000000'; // Fallback
    }
    console.log(`Using user ID: ${users[0].id} for testing.`);
    return users[0].id;
}

async function runTests() {
    console.log('Starting crawl tests (Direct Orchestrator Call)...');

    const userId = await getSystemUserId();
    process.env.SUPABASE_SYSTEM_USER_ID = userId;

    const results = [];

    for (const url of urls) {
        console.log(`Processing: ${url}`);
        try {
            const result = await orchestrator.processUrl(url);
            console.log(`✅ Success: ${url}`);
            results.push({ success: true, url, data: result });
        } catch (error) {
            console.error(`❌ Failed: ${url} - ${error.message}`);
            results.push({ success: false, url, error: error.message });
        }
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n=== Test Report ===');
    let successCount = 0;
    let failCount = 0;

    results.forEach((res, index) => {
        const status = res.success ? '✅ Success' : '❌ Failed';
        console.log(`${index + 1}. ${status} - ${res.url}`);
        if (!res.success) {
            console.log(`   Error: ${res.error}`);
        } else {
            const title = res.data.data?.title || 'No Title'; // Title might be in data even if not in DB
            const imageCount = res.data.data?.images?.length || 0;
            console.log(`   Title: ${title.substring(0, 50)}...`);
            console.log(`   Images: ${imageCount}`);
        }
        if (res.success) successCount++;
        else failCount++;
    });

    console.log(`\nTotal: ${results.length}, Success: ${successCount}, Failed: ${failCount}`);
}

runTests();
