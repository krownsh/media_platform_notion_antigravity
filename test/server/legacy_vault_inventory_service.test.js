import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildLegacyVaultInventory } from '../../server/services/legacyVaultInventoryService.js';

test('legacy inventory separates post, Topic, and excluded system candidates without writing files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-media-vault-'));
    try {
        await fs.mkdir(path.join(root, 'wiki', 'threads', 'threads'), { recursive: true });
        await fs.mkdir(path.join(root, 'wiki', 'threads', 'generic'), { recursive: true });
        await fs.mkdir(path.join(root, 'wiki', 'domains', 'UIUX'), { recursive: true });
        await fs.writeFile(path.join(root, 'wiki', 'threads', 'threads', 'post--abcd1234.md'), '- database_post_id: abcd1234-0000-4000-8000-000000000000\n');
        await fs.writeFile(path.join(root, 'wiki', 'domains', 'UIUX', 'AI介面品質.md'), '# AI介面品質\n跨來源整理\n');
        await fs.writeFile(path.join(root, 'wiki', 'domains', 'UIUX', '產線.md'), "---\ntype: knowledge\nsources:\n  - post_id: abcd1234-0000-4000-8000-000000000000\n  - post_id: bcde2345-0000-4000-8000-000000000000\n---\n# 產線\n");
        await fs.writeFile(path.join(root, 'wiki', 'threads', 'generic', 'example.md'), '- database_post_id: cdef3456-0000-4000-8000-000000000000\n- source_url: https://example.com/\n');
        await fs.writeFile(path.join(root, 'wiki', 'domains', 'UIUX', '_index.md'), '# index\n');

        const inventory = await buildLegacyVaultInventory({ vaultRoot: root });

        assert.deepEqual(inventory.map(item => [item.relativePath, item.candidateKind, item.postId]), [
            ['wiki/domains/UIUX/_index.md', 'excluded_system', null],
            ['wiki/domains/UIUX/AI介面品質.md', 'topic_candidate', null],
            ['wiki/domains/UIUX/產線.md', 'topic_candidate', null],
            ['wiki/threads/generic/example.md', 'excluded_system', null],
            ['wiki/threads/threads/post--abcd1234.md', 'post_candidate', 'abcd1234-0000-4000-8000-000000000000']
        ]);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});
