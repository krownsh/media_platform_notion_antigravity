import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    appendPostCaseFileEvent,
    deriveProvisionalPostTitle,
    rehomePostCaseFileToInbox,
    writeInitialPostCaseFile
} from '../../server/services/localMediaKnowledgeVaultService.js';

test('provisional case-file titles preserve a source title or derive a readable source phrase', () => {
    assert.equal(
        deriveProvisionalPostTitle({ title: '  建立可靠的 Obsidian 收件匣工作流  ', platform: 'threads' }),
        '建立可靠的 Obsidian 收件匣工作流'
    );
    assert.equal(
        deriveProvisionalPostTitle({
            platform: 'threads',
            content: '🚀 將每篇貼文先完整落盤到 Inbox，日後再從同一檔案討論與整理。這樣不會遺失來源。'
        }),
        '將每篇貼文先完整落盤到 Inbox，日後再從同一檔案討論與整理'
    );
    assert.equal(
        deriveProvisionalPostTitle({ platform: 'threads', author_name: 'Unknown' }),
        'Threads 貼文（來源待修復）'
    );
    assert.equal(
        deriveProvisionalPostTitle({
            platform: 'threads',
            title: '謝孟恭資格考倒數,但是claude code很強交給他就可以 謝孟恭逐字稿podcast網站更新整理全部 657 集換上新標題+摘要 EP643'
        }),
        '謝孟恭資格考倒數,但是claude code很強交給他就可以'
    );
    assert.equal(
        deriveProvisionalPostTitle({ platform: 'threads', title: '壞掉的\ud800來源標題' }).includes('\ud800'),
        false
    );
});

test('a case file uses the immutable payload body when the legacy post row has no body', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'media-knowledge-vault-'));
    await fs.mkdir(path.join(vaultRoot, '.obsidian'));
    try {
        const result = await writeInitialPostCaseFile({
            vaultRoot,
            post: {
                id: 'post-payload-0000-4000-8000-000000000000',
                platform: 'threads',
                original_url: 'https://www.threads.net/@owner/post/payload',
                content: '',
                created_at: '2026-10-11T05:30:00.000Z'
            },
            sourceRevisionId: 'revision-payload',
            captureQuality: 'partial',
            sourcePayload: {
                post: { content: '完整保存於 immutable source payload 的本文。' }
            }
        });

        const content = await fs.readFile(path.join(vaultRoot, result.relativePath), 'utf8');
        assert.match(content, /完整保存於 immutable source payload 的本文。/);
        assert.match(content, /來源完整度：部分擷取/);
        assert.match(content, /下一步：開始內容討論或修復來源/);
    } finally {
        await fs.rm(vaultRoot, { recursive: true, force: true });
    }
});

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

test('retrying initial delivery reuses the same post case file without overwriting owner notes', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'media-knowledge-vault-'));
    await fs.mkdir(path.join(vaultRoot, '.obsidian'));
    try {
        const input = {
            vaultRoot,
            post: {
                id: 'post-retry-0000-4000-8000-000000000000', title: 'Retry-safe source',
                content: 'Source snapshot.', created_at: '2026-10-11T07:00:00.000Z'
            },
            sourceRevisionId: 'revision-retry'
        };
        const created = await writeInitialPostCaseFile(input);
        const notePath = path.join(vaultRoot, created.relativePath);
        await fs.appendFile(notePath, 'Owner note remains.\n');

        const retried = await writeInitialPostCaseFile(input);
        const content = await fs.readFile(notePath, 'utf8');
        assert.equal(retried.relativePath, created.relativePath);
        assert.match(content, /Owner note remains\./);
        assert.equal(retried.checksum.length, 64);
    } finally {
        await fs.rm(vaultRoot, { recursive: true, force: true });
    }
});

test('rehoming a case file moves the same file to Inbox without losing owner notes', async () => {
    const vaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'media-knowledge-vault-'));
    await fs.mkdir(path.join(vaultRoot, '.obsidian'));
    try {
        const post = {
            id: 'post-rehome-0000-4000-8000-000000000000', title: 'Readable source title',
            content: 'Captured source.', created_at: '2026-10-11T07:00:00.000Z'
        };
        const created = await writeInitialPostCaseFile({ vaultRoot, post, sourceRevisionId: 'revision-rehome' });
        const originalPath = path.join(vaultRoot, created.relativePath);
        const formalRelativePath = 'Media Knowledge/Posts/Accepted/2026-10-11｜Accepted title｜post-reho.md';
        const formalPath = path.join(vaultRoot, formalRelativePath);
        await fs.mkdir(path.dirname(formalPath), { recursive: true });
        await fs.rename(originalPath, formalPath);
        await fs.appendFile(formalPath, 'Owner note remains after rehome.\n');

        const rehomed = await rehomePostCaseFileToInbox({
            vaultRoot, relativePath: formalRelativePath, post,
            sourcePayload: { post: { title: 'Readable source title', content: 'Captured source.' } }
        });

        assert.match(rehomed.relativePath, /^Media Knowledge\/Posts\/Inbox\//);
        assert.equal(await fs.stat(formalPath).then(() => true).catch(() => false), false);
        const content = await fs.readFile(path.join(vaultRoot, rehomed.relativePath), 'utf8');
        assert.match(content, /post_id: post-rehome-0000-4000-8000-000000000000/);
        assert.match(content, /Owner note remains after rehome\./);
    } finally {
        await fs.rm(vaultRoot, { recursive: true, force: true });
    }
});
