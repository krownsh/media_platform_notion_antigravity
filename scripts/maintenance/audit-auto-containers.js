import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function outputDirectory(args) {
    const index = args.indexOf('--output');
    const value = index >= 0 ? args[index + 1] : process.env.CONTAINER_MIGRATION_OUTPUT;
    if (!value) throw new Error('Use --output <directory> (a non-repository artifact directory).');
    return path.resolve(value);
}

export async function auditAutoContainers({ supabase, output }) {
    const [posts, collections, topics, matches] = await Promise.all([
        supabase.from('collection_posts').select('id,user_id,collection_id,platform,title,created_at'),
        supabase.from('collection_collections').select('id,user_id,name,description,created_at'),
        supabase.from('collection_topics').select('id,user_id,slug,title,origin,status,created_at'),
        supabase.from('collection_topic_source_matches').select('topic_id,source_id,user_id,status,created_at')
    ]);
    for (const result of [posts, collections, topics, matches]) if (result.error) throw new Error(`Read-only audit failed: ${result.error.message}`);
    const postRows = posts.data || [];
    const collectionRows = collections.data || [];
    const topicRows = topics.data || [];
    const matchRows = matches.data || [];
    const postCount = new Map();
    for (const post of postRows) if (post.collection_id) postCount.set(post.collection_id, (postCount.get(post.collection_id) || 0) + 1);
    const sourceCount = new Map();
    for (const match of matchRows) sourceCount.set(match.topic_id, (sourceCount.get(match.topic_id) || 0) + 1);
    const baseline = {
        generated_at: new Date().toISOString(), read_only: true,
        posts: postRows.length, collections: collectionRows.length, topics: topicRows.length,
        auto_collections: collectionRows.filter(row => /Hermes 自動|agent_auto/i.test(row.description || '')).map(row => ({ ...row, post_count: postCount.get(row.id) || 0 })),
        auto_topics: topicRows.filter(row => row.origin === 'agent_auto').map(row => ({ ...row, source_count: sourceCount.get(row.id) || 0 }))
    };
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, 'baseline.json'), `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    return baseline;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
    const { supabase } = await import('../../server/supabaseClient.js');
    const output = outputDirectory(process.argv.slice(2));
    auditAutoContainers({ supabase, output }).then(result => console.log(JSON.stringify({ ok: true, output, counts: { posts: result.posts, collections: result.collections, topics: result.topics } }))).catch(error => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
}
