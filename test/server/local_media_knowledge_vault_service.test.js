import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    appendPostCaseFileEvent,
    writeInitialPostCaseFile
} from '../../server/services/localMediaKnowledgeVaultService.js';

test('an initial post case file is written under Inbox with the full source snapshot', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'media-knowledge-vault-'));
    await fs.mkdir(path.join(vaultRoot, '.obsidian'));
    try {
        const result = await writeInitialPostCaseFile({
            vaultRoot,
            post: {
                id: 'post-12345678-0000-4000-8000-000000000000',
                title: 'Figma design systems',
                platform: 'threads',
                original_url: 'https://www.threads.net/@design/post/example',
                content: 'Complete captured source text.',
                created_at: '2026-10-09T03:20:00.000Z'
            },
            sourceRevisionId: 'revision-1',
            workflowId: 'workflow-1',
            sourcePayload: {
                comments: [{ author_name: 'Reader', content: 'A useful response.' }],
                media: [{ type: 'image', url: 'https://example.test/image.jpg', alt_text: 'A reference image.' }]
            }
        });

        assert.equal(result.relativePath, 'Media Knowledge/Posts/Inbox/2026-10-09｜暫定：Figma design systems｜post-123.md');
        const content = await fs.readFile(path.join(vaultRoot, result.relativePath), 'utf8');
        assert.match(content, /post_id: post-12345678-0000-4000-8000-000000000000/);
        assert.match(content, /source_revision_id: revision-1/);
        assert.match(content, /<!-- BEGIN MEDIA SOURCE SNAPSHOT -->/);
        assert.match(content, /Complete captured source text\./);
        assert.doesNotMatch(content, /完整擷取結構|\`\`\`json/);
        assert.match(content, /### 媒體參考/);
        assert.match(content, /### 來源留言/);
        assert.match(content, /Reader：A useful response\./);
        assert.match(content, /https:\/\/example\.test\/image\.jpg/);
        assert.match(content, /<!-- BEGIN MEDIA EVENT LOG -->/);
        assert.match(content, /### 2026-10-09 03:20｜擷取｜已記錄/);
        assert.match(content, /## 你的自由筆記/);
    } finally {
        await fs.rm(vaultRoot, { recursive: true, force: true });
    }
});

test('an event is appended inside the managed log without rewriting the Owner free-notes section', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'media-knowledge-vault-'));
    await fs.mkdir(path.join(vaultRoot, '.obsidian'));
    try {
        const created = await writeInitialPostCaseFile({
            vaultRoot,
            post: {
                id: 'post-abcdefgh-0000-4000-8000-000000000000',
                title: 'Original title',
                content: 'Original source.',
                created_at: '2026-10-09T04:00:00.000Z'
            },
            sourceRevisionId: 'revision-1'
        });
        const notePath = path.join(vaultRoot, created.relativePath);
        const before = await fs.readFile(notePath, 'utf8');
        await fs.writeFile(notePath, `${before}My private free note.\n`);

        const result = await appendPostCaseFileEvent({
            vaultRoot,
            relativePath: created.relativePath,
            event: {
                eventId: 'event-1',
                occurredAt: '2026-10-09T05:20:00.000Z',
                type: 'legacy_import_candidate',
                status: 'candidate',
                actor: 'agent',
                conclusion: 'Old note found; waiting for Owner acceptance.',
                legacyPath: 'wiki/threads/threads/post--abcdefgh.md'
            }
        });

        const content = await fs.readFile(notePath, 'utf8');
        assert.equal(result.relativePath, created.relativePath);
        assert.match(content, /### 2026-10-09 05:20｜legacy_import_candidate｜候選/);
        assert.match(content, /- event_id: event-1/);
        assert.match(content, /- legacy_path: wiki\/threads\/threads\/post--abcdefgh\.md/);
        assert.match(content, /Old note found; waiting for Owner acceptance\./);
        assert.ok(content.indexOf('### 2026-10-09 05:20') < content.indexOf('<!-- END MEDIA EVENT LOG -->'));
        assert.match(content, /## 你的自由筆記\nMy private free note\./);
    } finally {
        await fs.rm(vaultRoot, { recursive: true, force: true });
    }
});
