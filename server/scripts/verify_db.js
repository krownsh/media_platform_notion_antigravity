import { supabase } from '../supabaseClient.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyDatabase() {
    console.log('Verifying database content...');

    const { data: posts, error } = await supabase
        .from('posts')
        .select('id, original_url, content, full_json, platform, created_at')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching posts:', error);
        return;
    }

    console.log(`Found ${posts.length} posts.`);

    posts.forEach((post, index) => {
        console.log(`\n--- Post ${index + 1} ---`);
        console.log(`URL: ${post.original_url}`);
        console.log(`Platform: ${post.platform}`);
        console.log(`Content: ${post.content ? post.content.substring(0, 50) + '...' : 'N/A'}`);

        let imageCount = 0;
        let replyCount = 0;

        if (post.full_json) {
            const json = typeof post.full_json === 'string' ? JSON.parse(post.full_json) : post.full_json;
            // Check for images in full_json
            // Structure might be { images: [...] } or [{ images: [...] }]
            const root = Array.isArray(json) ? json[0] : json;
            if (root && root.images) {
                imageCount = root.images.length;
            }

            // Check for replies
            if (root && root.replies) {
                replyCount = root.replies.length;
            }
        }
        console.log(`Images (in JSON): ${imageCount}`);
        console.log(`Reply Count (in JSON): ${replyCount}`);
    });
}

verifyDatabase();
