import { isSupabaseConfigured, supabase } from '../../server/supabaseClient.js';

async function main() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase service client is not configured');
  }

  const startedAt = Date.now();
  const { count, error } = await supabase
    .from('collection_post_analysis')
    .select('id, insights', { count: 'exact', head: true });

  if (error) {
    throw new Error(`POC storage preflight failed: ${error.message}`);
  }

  console.log(`[POC Storage] collection_post_analysis.insights is accessible; rows=${count ?? 'unknown'}; duration_ms=${Date.now() - startedAt}`);
}

main().catch(error => {
  console.error('[POC Storage] Failed:', error.message);
  process.exitCode = 1;
});

