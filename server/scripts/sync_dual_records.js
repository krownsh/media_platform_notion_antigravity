import { syncBriefsToSupabase } from './sync_briefs_to_supabase.js';
import { syncTopicsToSupabase } from './sync_topics_to_supabase.js';

export async function syncAllDualRecords() {
    console.log('==============================================');
    console.log('🔄 開始執行全量雙軌同步 (Dual-Sync Master)...');
    console.log('==============================================');

    console.log('\n[1/2] 正在同步創作母卷 (Agent Briefs -> content_assets)...');
    await syncBriefsToSupabase();

    console.log('\n[2/2] 正在同步主題台帳 (Topics -> owner_topics & owner_topic_source_links)...');
    await syncTopicsToSupabase();

    console.log('\n==============================================');
    console.log('✅ 全量雙軌同步完成 (Vault Markdown <-> Supabase DB)');
    console.log('==============================================');
}

if (process.argv[1] && process.argv[1].endsWith('sync_dual_records.js')) {
    syncAllDualRecords()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Fatal dual-sync error:', err);
            process.exit(1);
        });
}
