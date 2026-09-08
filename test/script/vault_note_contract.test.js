import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildVaultNotePaths, VAULT_MANAGED_END, VAULT_MANAGED_START, verifyVaultRoot, writeWorkflowVaultNotes } from '../../server/services/vaultNoteService.js';
import { formatWorkflow } from '../../scripts/agent-sdk/next-workflow.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fixtureWorkflow() {
    return {
        id: 'workflow-123',
        action_plan: {
            actions: [
                { type: 'replication_plan', status: 'approved' },
                { type: 'vault_note', status: 'approved' }
            ]
        },
        collection_posts: {
            id: 'post-123',
            platform: 'threads',
            created_at: '2026-09-03T10:00:00.000Z',
            original_url: 'https://example.test/posts/123',
            title: '來源貼文',
            content: '這是完整原文內容。',
            collection_collections: { id: 'collection-agent-tools', name: 'agent工具' },
            collection_post_analysis: {
                primary_category: '個人品牌',
                summary: '來源摘要',
                tags: ['內容'],
                topics: ['品牌']
            }
        }
    };
}

test('Vault note writes one source note and keeps replication in its managed block', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-'));
    await fs.mkdir(path.join(root, '.obsidian'));
    const result = await writeWorkflowVaultNotes({
        workflow: fixtureWorkflow(),
        vaultRoot: root,
        noteInput: {
            domain: '個人品牌',
            note_title: 'Wallpets 深度研究與複製規劃',
            discussion: '使用者決定先研究再評估復刻。',
            replication: {
                project_name: 'Wallpets 復刻項目',
                goal: '測試引流假設',
                mvp: '最小版本',
                acceptance_criteria: ['可完成一條流程']
            }
        }
    });

    assert.equal(result.post_id, 'post-123');
    assert.equal(result.relative_path, 'wiki/threads/threads/2026-09-03-Wallpets 深度研究與複製規劃--post-123.md');
    assert.equal(result.replication_path, null);
    const source = await fs.readFile(path.join(root, result.relative_path), 'utf8');
    assert.match(source, /database_post_id: post-123/);
    assert.match(source, /https:\/\/example\.test\/posts\/123/);
    assert.match(source, /完整原文內容/);
    assert.match(source, /## 復刻方案/);
    assert.match(source, /Wallpets 復刻項目/);
});

test('Vault note retry preserves text outside the managed block', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-'));
    await fs.mkdir(path.join(root, 'wiki'));
    const input = {
        domain: '測試',
        note_title: '保留人工內容',
        original_content: '第一次內容'
    };
    const workflow = fixtureWorkflow();
    workflow.action_plan.actions = [{ type: 'vault_note', status: 'approved' }];
    await writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: input });
    const filePath = path.join(root, 'wiki', 'threads', 'threads', '2026-09-03-保留人工內容--post-123.md');
    await fs.appendFile(filePath, '\n\n## 人工補充\n不要覆蓋我\n');
    workflow.collection_posts.content = '第二次內容';
    workflow.collection_posts.collection_collections.name = '重新命名的資料夾';
    await writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: input });
    const content = await fs.readFile(filePath, 'utf8');
    assert.match(content, /第二次內容/);
    assert.match(content, /不要覆蓋我/);
    await assert.rejects(fs.stat(path.join(root, 'wiki', 'collections')));
});

test('Vault retry reuses its recorded note when title or date changes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-'));
    await fs.mkdir(path.join(root, '.obsidian'));
    const workflow = fixtureWorkflow();
    const first = await writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: { note_title: '原始標題' } });
    const filePath = path.join(root, first.relative_path);
    await fs.appendFile(filePath, '\n\n## 人工補充\n保留這段\n');
    workflow.context = { vault: { relative_path: first.relative_path } };
    workflow.collection_posts.created_at = '2026-09-04T10:00:00.000Z';
    workflow.collection_posts.title = '更新後來源標題';
    const retry = await writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: { note_title: '更新後顯示標題' } });

    assert.equal(retry.relative_path, first.relative_path);
    assert.match(await fs.readFile(filePath, 'utf8'), /保留這段/);
    await assert.rejects(fs.stat(path.join(root, 'wiki', 'threads', 'threads', '2026-09-04-更新後顯示標題--post-123.md')));
});

test('Vault retry fails instead of creating a second note when its recorded path is missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-'));
    await fs.mkdir(path.join(root, '.obsidian'));
    const workflow = fixtureWorkflow();
    workflow.context = { vault: { relative_path: 'wiki/threads/threads/missing--post-123.md' } };

    await assert.rejects(
        writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: { note_title: '不應建立' } }),
        error => error.code === 'VAULT_RECORDED_PATH_UNAVAILABLE'
    );
    await assert.rejects(fs.stat(path.join(root, 'wiki', 'threads', 'threads', '2026-09-03-不應建立--post-123.md')));
});

test('Vault retry rejects a recorded path that belongs to another post or has manual content', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-'));
    await fs.mkdir(path.join(root, '.obsidian'));
    const workflow = fixtureWorkflow();
    const relativePath = 'wiki/threads/threads/conflict--post-123.md';
    await fs.mkdir(path.join(root, 'wiki', 'threads', 'threads'), { recursive: true });
    await fs.writeFile(path.join(root, relativePath), `${VAULT_MANAGED_START}\n- database_post_id: another-post\n${VAULT_MANAGED_END}\n`);
    workflow.context = { vault: { relative_path: relativePath } };

    await assert.rejects(
        writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: { note_title: '不應覆寫' } }),
        error => error.code === 'VAULT_RECORDED_PATH_CONFLICT'
    );

    const manualPath = 'wiki/threads/threads/manual--post-123.md';
    await fs.writeFile(path.join(root, manualPath), '# 人工筆記\n只屬於使用者\n');
    workflow.context = { vault: { relative_path: manualPath } };
    await assert.rejects(
        writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: { note_title: '也不應覆寫' } }),
        error => error.code === 'VAULT_RECORDED_PATH_CONFLICT'
    );
});

test('Vault retry rejects conflicting recorded paths instead of selecting one', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-'));
    await fs.mkdir(path.join(root, '.obsidian'));
    const workflow = fixtureWorkflow();
    const first = await writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: { note_title: '第一份' } });
    const secondPath = 'wiki/threads/threads/第二份--post-123.md';
    await fs.mkdir(path.dirname(path.join(root, secondPath)), { recursive: true });
    await fs.copyFile(path.join(root, first.relative_path), path.join(root, secondPath));
    workflow.context = {
        vault: { relative_path: first.relative_path },
        vault_sync: { relative_path: secondPath }
    };

    await assert.rejects(
        writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: { note_title: '不選任何一份' } }),
        error => error.code === 'VAULT_RECORDED_PATH_CONFLICT'
    );
});

test('Vault retry rejects a recorded path that resolves outside the Vault through a symlink', async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-'));
    const external = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-external-'));
    await fs.mkdir(path.join(root, '.obsidian'));
    await fs.mkdir(path.join(root, 'wiki'));
    await fs.mkdir(path.join(external, 'threads'), { recursive: true });
    const relativePath = 'wiki/threads/symlink--post-123.md';
    await fs.writeFile(path.join(external, 'threads', 'symlink--post-123.md'), `${VAULT_MANAGED_START}\n- database_post_id: post-123\n${VAULT_MANAGED_END}\n`);
    try {
        await fs.symlink(path.join(external, 'threads'), path.join(root, 'wiki', 'threads'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
        if (error.code === 'EPERM' || error.code === 'EACCES') {
            t.skip('Current Windows permissions do not allow symlink fixtures');
            return;
        }
        throw error;
    }
    const workflow = fixtureWorkflow();
    workflow.context = { vault: { relative_path: relativePath } };

    await assert.rejects(
        writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: { note_title: '不應越界' } }),
        error => error.code === 'VAULT_RECORDED_PATH_INVALID'
    );
});

test('Vault draft retry keeps the recorded draft path when its title changes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-'));
    await fs.mkdir(path.join(root, '.obsidian'));
    const workflow = fixtureWorkflow();
    const first = await writeWorkflowVaultNotes({
        workflow,
        vaultRoot: root,
        noteInput: { note_title: '來源筆記', content_draft: { title: '第一版草稿', format: 'x_thread', body: '第一版內容' } }
    });
    const draftFile = path.join(root, first.draft_path);
    await fs.appendFile(draftFile, '\n人工草稿備註\n');
    workflow.context = { vault: { relative_path: first.relative_path, draft_path: first.draft_path } };
    workflow.collection_posts.title = '更新後來源標題';
    const retry = await writeWorkflowVaultNotes({
        workflow,
        vaultRoot: root,
        noteInput: { note_title: '更新後筆記', content_draft: { title: '第二版草稿', format: 'x_thread', body: '第二版內容' } }
    });

    assert.equal(retry.draft_path, first.draft_path);
    assert.match(await fs.readFile(draftFile, 'utf8'), /第二版內容/);
    assert.match(await fs.readFile(draftFile, 'utf8'), /人工草稿備註/);
    await assert.rejects(fs.stat(path.join(root, 'content', 'drafts', 'threads', 'x_thread', '第二版草稿-post-123.md')));
});

test('Vault source paths stay platform-based and ignore Collection classification', () => {
    const root = path.join(os.tmpdir(), 'media-vault-path-contract');
    const filed = buildVaultNotePaths(root, { note_title: '內容分類' }, fixtureWorkflow().collection_posts);
    assert.equal(filed.wiki.relative_path, 'wiki/threads/threads/2026-09-03-內容分類--post-123.md');
    assert.equal(filed.platform, 'threads');

    const unfiledPost = { ...fixtureWorkflow().collection_posts, collection_collections: null };
    const unfiled = buildVaultNotePaths(root, { note_title: '未分類內容' }, unfiledPost);
    assert.equal(unfiled.wiki.relative_path, 'wiki/threads/threads/2026-09-03-未分類內容--post-123.md');
});

test('AI title remains a fallback for a titleless platform note', () => {
    const root = path.join(os.tmpdir(), 'media-vault-title-contract');
    const post = {
        ...fixtureWorkflow().collection_posts,
        title: null,
        collection_post_analysis: { generated_title: 'AI 補回標題' }
    };
    const result = buildVaultNotePaths(root, {}, post);
    assert.equal(result.wiki.relative_path, 'wiki/threads/threads/2026-09-03-AI 補回標題--post-123.md');
});

test('skill and CLI expose bounded source preview and mandatory note action', async () => {
    const skill = await fs.readFile(path.join(projectRoot, 'hermes', 'skills', 'my-mediacrawl-skill', 'SKILL.md'), 'utf8');
    const next = await fs.readFile(path.join(projectRoot, 'scripts', 'agent-sdk', 'next-workflow.js'), 'utf8');
    const decide = await fs.readFile(path.join(projectRoot, 'scripts', 'agent-sdk', 'decide-workflow.js'), 'utf8');
    assert.match(skill, /first 1,000 characters/);
    assert.match(skill, /agent:vault-note/);
    assert.match(skill, /There is no POC worker/);
    assert.match(next, /ORIGINAL_CONTENT_PREVIEW_LIMIT = 1_000/);
    assert.match(decide, /vault_note/);
});

test('agent:next returns exactly the first 1,000 captured characters', () => {
    const full = '甲'.repeat(1_001);
    const result = formatWorkflow({
        id: 'workflow-preview',
        outbox_event_id: 'outbox-preview',
        source_type: 'url_capture',
        stage: 'strategy',
        status: 'awaiting_user',
        action_plan: { actions: [] },
        collection_posts: { id: 'post-preview', platform: 'threads', content: full }
    });
    assert.equal(result.post.content.length, 1_000);
    assert.equal(result.post.content_length, 1_001);
    assert.equal(result.post.content_truncated, true);
    assert.equal(result.post.content_preview, result.post.content);
});

test('missing Vault is an explicit user-confirmation blocker', async () => {
    await assert.rejects(
        verifyVaultRoot(path.join(os.tmpdir(), 'media-vault-path-that-does-not-exist')),
        error => error.code === 'VAULT_NOT_FOUND' && /Ask the user/.test(error.message)
    );
});

test('existing Vault path distinguishes uninitialized folder from a tool checkout', async () => {
    const uninitialized = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-uninitialized-'));
    await assert.rejects(
        verifyVaultRoot(uninitialized),
        error => error.code === 'VAULT_NOT_INITIALIZED'
            && /Open this directory once as an Obsidian Vault/.test(error.message)
    );

    const checkout = await fs.mkdtemp(path.join(os.tmpdir(), 'media-vault-checkout-'));
    await fs.mkdir(path.join(checkout, '.git'));
    await assert.rejects(
        verifyVaultRoot(checkout),
        error => error.code === 'VAULT_NOT_RECOGNIZED'
            && /tool checkout/.test(error.message)
    );
});
