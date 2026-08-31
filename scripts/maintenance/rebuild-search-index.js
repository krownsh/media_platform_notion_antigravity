import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { supabase } from '../../server/supabaseClient.js';
import { upsertPostSearchDocument } from '../../server/services/postSearchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

const PAGE_SIZE = 100;

async function rebuildSearchIndex() {
    let offset = 0;
    let indexed = 0;
    while (true) {
        const { data, error } = await supabase
            .from('collection_posts')
            .select(`
                id, user_id, platform, original_url, title, author_name, content, collection_id,
                collection_post_analysis (*),
                collection_post_comments (content),
                collection_post_workflows (stage, status, updated_at),
                collection_user_annotations (content),
                content_assets (
                    id, title, metadata,
                    content_revisions (revision_number, body)
                )
            `)
            .order('created_at', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data?.length) break;

        for (const post of data) {
            await upsertPostSearchDocument(post);
            indexed += 1;
        }

        offset += data.length;
        process.stdout.write(`indexed=${indexed}\n`);
        if (data.length < PAGE_SIZE) break;
    }
    return { ok: true, indexed };
}

rebuildSearchIndex()
    .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
        process.exitCode = 1;
    });
