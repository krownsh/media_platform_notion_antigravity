import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function csv(rows, headers) {
    const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return [headers.join(','), ...rows.map(row => headers.map(header => quote(row[header])).join(','))].join('\n') + '\n';
}

export async function planAutoContainerMigration(output) {
    const baseline = JSON.parse(await readFile(path.join(output, 'baseline.json'), 'utf8'));
    const collections = baseline.auto_collections.map(row => ({ old_id: row.id, name: row.name, post_count: row.post_count, proposed_action: row.post_count <= 1 ? 'owner_review_unfiled_or_relink' : 'owner_review_canonical_collection', confidence: '0', reason: 'dry-run only; no semantic merge is inferred' }));
    const topics = baseline.auto_topics.map(row => ({ old_id: row.id, slug: row.slug, title: row.title, source_count: row.source_count, proposed_action: row.source_count <= 1 ? 'owner_review_archive_or_relink' : 'owner_review_canonical_topic', confidence: '0', reason: 'dry-run only; no semantic merge is inferred' }));
    const unresolved = { generated_at: new Date().toISOString(), read_only: true, collections: collections.filter(row => row.confidence === '0'), topics: topics.filter(row => row.confidence === '0'), vault: 'Not scanned: no Vault files are moved or read by this dry-run.' };
    await Promise.all([
        writeFile(path.join(output, 'collection-plan.csv'), csv(collections, ['old_id','name','post_count','proposed_action','confidence','reason']), 'utf8'),
        writeFile(path.join(output, 'topic-plan.csv'), csv(topics, ['old_id','slug','title','source_count','proposed_action','confidence','reason']), 'utf8'),
        writeFile(path.join(output, 'vault-plan.csv'), 'old_path,post_id,proposed_path,confidence,reason\n', 'utf8'),
        writeFile(path.join(output, 'unresolved.json'), `${JSON.stringify(unresolved, null, 2)}\n`, 'utf8')
    ]);
    return { collections: collections.length, topics: topics.length, unresolved: unresolved.collections.length + unresolved.topics.length };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
    const index = process.argv.indexOf('--output');
    const rawOutput = index >= 0 ? process.argv[index + 1] : process.env.CONTAINER_MIGRATION_OUTPUT;
    if (!rawOutput) throw new Error('Use --output <directory> after the read-only audit.');
    const output = path.resolve(rawOutput);
    planAutoContainerMigration(output).then(result => console.log(JSON.stringify({ ok: true, output, ...result }))).catch(error => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
}
