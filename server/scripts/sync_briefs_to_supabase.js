import { supabase } from '../supabaseClient.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function syncBriefsToSupabase() {
    const draftsDir = '/Volumes/DevSSD/10_Projects/Personal/media_collection/Media Knowledge/Drafts';
    const files = fs.readdirSync(draftsDir).filter((f) => f.includes('｜Brief｜') && f.endsWith('.md'));
    const userId = '50984520-69ad-4e64-b9c1-503f5c1b0e63';

    console.log(`Found ${files.length} Brief files to sync.`);

    for (const file of files) {
        const fullPath = path.join(draftsDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const match = content.match(/^---([\s\S]*?)---([\s\S]*)$/);
        if (!match) continue;

        const frontmatterText = match[1];
        const body = match[2].trim();

        // Parse frontmatter
        const meta = {};
        for (const line of frontmatterText.split('\n')) {
            const idx = line.indexOf(':');
            if (idx > -1) {
                const k = line.slice(0, idx).trim();
                const v = line.slice(idx + 1).trim().replace(/^["'\s]+|["'\s]+$/g, '');
                meta[k] = v;
            }
        }

        const sourcePostId = meta.source_post_id;
        if (!sourcePostId) {
            console.log(`Skipping ${file}: no source_post_id`);
            continue;
        }

        // Title from file name
        const titleMatch = file.match(/創作母卷：([^｜]+)/);
        const title = titleMatch ? `創作母卷：${titleMatch[1]}` : file.replace('.md', '');

        // Deterministic UUID for the asset based on source_post_id
        const assetIdHash = crypto.createHash('sha256').update(`agent-brief:${sourcePostId}`).digest('hex');
        const assetId = [
            assetIdHash.slice(0, 8),
            assetIdHash.slice(8, 12),
            '4' + assetIdHash.slice(13, 16),
            '8' + assetIdHash.slice(17, 20),
            assetIdHash.slice(20, 32)
        ].join('-');

        const assetMetadata = {
            type: 'media_agent_brief',
            domain_theme: meta.domain_theme || '未分類',
            core_topic: meta.core_topic || '',
            core_angle: meta.core_angle || '',
            source_url: meta.source_url || '',
            source_platform: meta.source_platform || '',
            captured_at: meta.captured_at || meta.created_at || '2026-11-05',
            brief_file: file
        };

        // Upsert content_assets
        const { error: assetError } = await supabase.from('content_assets').upsert({
            id: assetId,
            user_id: userId,
            source_id: sourcePostId,
            title: title,
            format: 'blog_article',
            status: 'draft',
            metadata: assetMetadata,
            updated_at: new Date().toISOString()
        });

        if (assetError) {
            console.error(`Asset error on ${file}:`, assetError);
            continue;
        }

        // Upsert content_revisions (revision 1)
        const idempotencyKey = `brief-sync:v1:${assetId}`;
        const { error: revError } = await supabase.from('content_revisions').upsert({
            user_id: userId,
            content_asset_id: assetId,
            revision_number: 1,
            idempotency_key: idempotencyKey,
            body: body,
            change_summary: `Synced from ${file}`,
            author_type: 'user',
            updated_at: new Date().toISOString()
        }, { onConflict: 'content_asset_id,revision_number' });

        if (revError) {
            console.error(`Revision error on ${file}:`, revError);
        } else {
            console.log(`✅ Synced: [${meta.domain_theme}] ${title}`);
        }
    }
}

if (process.argv[1] && process.argv[1].endsWith('sync_briefs_to_supabase.js')) {
    syncBriefsToSupabase().then(() => {
        console.log('Sync process completed.');
        process.exit(0);
    }).catch((err) => {
        console.error('Fatal sync error:', err);
        process.exit(1);
    });
}
