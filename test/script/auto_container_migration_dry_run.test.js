import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { auditAutoContainers } from '../../scripts/maintenance/audit-auto-containers.js';
import { planAutoContainerMigration } from '../../scripts/maintenance/plan-auto-container-migration.js';

const auditScript = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../../scripts/maintenance/audit-auto-containers.js', import.meta.url), 'utf8'));

function fakeSupabase(rows) {
    return {
        from(table) {
            return {
                select: async () => ({ data: rows[table] || [], error: null })
            };
        }
    };
}

test('container migration dry-run is read-only and emits reviewable per-post manifests', async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), 'container-migration-'));
    try {
        const baseline = await auditAutoContainers({
            output,
            supabase: fakeSupabase({
                collection_posts: [{ id: 'post-1', user_id: 'user-1', collection_id: 'collection-1', platform: 'threads', title: 'A/B test', created_at: '2026-09-04T00:00:00Z' }],
                collection_collections: [
                    { id: 'collection-1', user_id: 'user-1', name: 'AI 工具', description: 'Hermes 自動建立', created_at: '2026-09-04T00:00:00Z' },
                    { id: 'foreign-agent-tools', user_id: 'user-2', name: 'agent工具', description: null, created_at: '2026-01-01T00:00:00Z' },
                    { id: 'owner-agent-tools', user_id: 'user-1', name: 'agent工具', description: null, created_at: '2026-01-01T00:00:00Z' }
                ],
                collection_topics: [{ id: 'topic-1', user_id: 'user-1', slug: 'agent-auto', title: 'Claude Code 工具鏈', origin: 'agent_auto', status: 'active', created_at: '2026-09-04T00:00:00Z' }],
                collection_topic_source_matches: [{ topic_id: 'topic-1', source_id: 'post-1', user_id: 'user-1', status: 'accepted', created_at: '2026-09-04T00:00:00Z' }]
            })
        });
        assert.equal(baseline.read_only, true);
        assert.deepEqual(baseline.auto_collections[0].post_ids, ['post-1']);
        assert.equal(baseline.owner_collections[0].name, 'agent工具');
        assert.deepEqual(baseline.auto_topics[0].source_ids, ['post-1']);

        await planAutoContainerMigration(output);
        const collectionPlan = await readFile(path.join(output, 'collection-plan.csv'), 'utf8');
        const topicPlan = await readFile(path.join(output, 'topic-plan.csv'), 'utf8');
        const vaultPlan = await readFile(path.join(output, 'vault-plan.csv'), 'utf8');
        const unresolved = JSON.parse(await readFile(path.join(output, 'unresolved.json'), 'utf8'));
        for (const file of [collectionPlan, topicPlan, vaultPlan]) {
            assert.match(file, /old_id,old_path,post_id,suggested_target,proposed_action,evidence,confidence,requires_owner_confirmation/);
            assert.match(file, /post-1/);
            assert.match(file, /true/);
        }
        assert.match(collectionPlan, /owner-agent-tools:agent工具/);
        assert.match(collectionPlan, /owner_review_relink_to_existing_collection/);
        assert.match(topicPlan, /github:krownsh\/media_platform_notion_antigravity#agent_workflow/);
        assert.match(topicPlan, /owner_review_relink_to_project_topic/);
        assert.match(vaultPlan, /wiki\/collections\/agent工具\/2026-09-04-A B test--post-1\.md/);
        assert.equal(unresolved.read_only, true);
        assert.equal(unresolved.collections[0].requires_owner_confirmation, 'true');
    } finally {
        await rm(output, { recursive: true, force: true });
    }
});

test('live dry-run requires an explicit environment file instead of inheriting credentials', () => {
    assert.match(auditScript, /--env-file/);
    assert.match(auditScript, /dotenv\.config\(\{ path: envFile, override: false, quiet: true \}\)/);
});
