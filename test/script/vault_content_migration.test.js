import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyVaultContentMigration, planVaultContentMigration } from '../../scripts/maintenance/migrate-vault-content-paths.js';

test('Vault migration copies, atomically repoints the workflow, then removes one verified legacy note', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vault-content-migration-'));
    const oldPath = 'wiki/domains/AI 工具/2026-09-01-note--post-123.md';
    await mkdir(path.join(root, '.obsidian'));
    await mkdir(path.join(root, path.dirname(oldPath)), { recursive: true });
    await writeFile(path.join(root, oldPath), 'manual text\n');
    const workflow = {
        id: 'workflow-1', user_id: 'owner-1', post_id: 'post-123', updated_at: '2026-09-07T00:00:00.000Z',
        context: { vault: { relative_path: oldPath } },
        action_plan: { actions: [{ type: 'vault_note', outcome: { relative_path: oldPath, post_id: 'post-123' } }] },
        collection_posts: { collection_collections: { id: 'collection-1', name: 'agent工具' } }
    };
    const manifest = await planVaultContentMigration({ workflows: [workflow], vaultRoot: root });
    assert.equal(manifest.rows[0].status, 'ready');
    assert.equal(manifest.rows[0].new_relative_path, 'wiki/collections/agent工具/2026-09-01-note--post-123.md');
    const updates = [];
    const supabase = {
        from: () => ({
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: workflow, error: null }) }) }) }),
            update: update => ({ eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => { updates.push(update); return { data: { id: 'workflow-1' }, error: null }; } }) }) }) }) })
        })
    };
    const result = await applyVaultContentMigration({ manifest, vaultRoot: root, supabase });
    assert.equal(result.ok, true);
    assert.equal(result.results[0].status, 'moved');
    assert.equal((await readFile(path.join(root, manifest.rows[0].new_relative_path), 'utf8')).trim(), 'manual text');
    await assert.rejects(stat(path.join(root, oldPath)));
    assert.equal(updates[0].context.vault.relative_path, manifest.rows[0].new_relative_path);
    assert.equal(updates[0].action_plan.actions[0].outcome.relative_path, manifest.rows[0].new_relative_path);
});

test('Vault migration never removes a pre-existing target note', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'vault-content-conflict-'));
    const oldPath = 'wiki/domains/AI 工具/2026-09-01-note--post-456.md';
    const newPath = 'wiki/collections/agent工具/2026-09-01-note--post-456.md';
    await mkdir(path.join(root, path.dirname(oldPath)), { recursive: true });
    await mkdir(path.join(root, path.dirname(newPath)), { recursive: true });
    await writeFile(path.join(root, oldPath), 'old note');
    await writeFile(path.join(root, newPath), 'manual target');
    const workflow = { id: 'workflow-2', user_id: 'owner-1', post_id: 'post-456', updated_at: '2026-09-07T00:00:00.000Z', context: { vault: { relative_path: oldPath } }, action_plan: {}, collection_posts: { collection_collections: { name: 'agent工具' } } };
    const manifest = await planVaultContentMigration({ workflows: [workflow], vaultRoot: root });
    assert.equal(manifest.rows[0].reason, 'target_already_exists');
    const result = await applyVaultContentMigration({ manifest, vaultRoot: root, supabase: null });
    assert.equal(result.ok, true);
    assert.equal((await readFile(path.join(root, newPath), 'utf8')).trim(), 'manual target');
    assert.equal((await readFile(path.join(root, oldPath), 'utf8')).trim(), 'old note');
});
