import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

import { supabase } from '../../server/supabaseClient.js';

/**
 * 取得待處理的收藏項目 (status = pending)
 */
async function getInbox() {
    console.log('[Agent SDK] Fetching pending inbox items...');
    
    // 取得 outbox 中的 pending 事件
    const { data: outboxEvents, error: outboxError } = await supabase
        .from('collection_capture_outbox')
        .select(`
            id, 
            aggregate_id, 
            event_type,
            created_at,
            collection_posts (
                id,
                platform,
                original_url,
                author_name,
                content,
                collection_post_analysis (
                    summary
                )
            )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (outboxError) {
        console.error('❌ Failed to fetch outbox events:', outboxError.message);
        process.exit(1);
    }

    if (!outboxEvents || outboxEvents.length === 0) {
        console.log('✅ No pending items in the inbox. You are all caught up!');
        process.exit(0);
    }

    console.log(`\n📬 Found ${outboxEvents.length} pending item(s):`);
    console.log('='.repeat(50));

    outboxEvents.forEach((event, index) => {
        const post = event.collection_posts;
        // In some supabase setups, joined tables return an array or single object. We handle both just in case.
        const postData = Array.isArray(post) ? post[0] : post; 
        
        if (!postData) {
            console.log(`\n[Item ${index + 1}] Outbox ID: ${event.id} (Warning: Linked post not found)`);
            return;
        }

        console.log(`\n[Item ${index + 1}] Outbox ID: ${event.id}`);
        console.log(`Platform: ${postData.platform}`);
        console.log(`URL: ${postData.original_url}`);
        console.log(`Author: ${postData.author_name || 'Unknown'}`);
        const analysis = Array.isArray(postData.collection_post_analysis) ? postData.collection_post_analysis[0] : postData.collection_post_analysis;
        console.log(`Summary: ${analysis?.summary || 'No summary available.'}`);
        console.log(`Type: ${event.event_type}`);
    });

    console.log('\n='.repeat(50));
    console.log('\n💡 Next Step: Run `npm run agent:analyze <Outbox_ID>` to deeply analyze and propose an action plan for a specific item.');
}

getInbox();
