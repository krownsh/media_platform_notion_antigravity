import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { supabase } from '../../server/supabaseClient.js';
import { refreshOwnerPostSearchDocument } from '../../server/services/ownerSearchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

const PAGE_SIZE = 100;

async function rebuildOwnerGuidedSearchIndex() {
    let offset = 0;
    let indexed = 0;
    while (true) {
        const { data, error } = await supabase
            .from('collection_posts')
            .select('id, user_id')
            .order('created_at', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data?.length) break;
        for (const post of data) {
            await refreshOwnerPostSearchDocument({ userId: post.user_id, postId: post.id });
            indexed += 1;
        }
        offset += data.length;
        process.stdout.write(`indexed=${indexed}\n`);
        if (data.length < PAGE_SIZE) break;
    }
    return { ok: true, indexed };
}

rebuildOwnerGuidedSearchIndex()
    .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
        process.exitCode = 1;
    });
