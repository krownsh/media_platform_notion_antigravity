import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyVaultRoot, writeWorkflowVaultNotes } from '../../server/services/vaultNoteService.js';
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
            original_url: 'https://example.test/posts/123',
            title: '來源貼文',
            content: '這是完整原文內容。',
            collection_post_analysis: {
                primary_category: '個人品牌',
                summary: '來源摘要',
                tags: ['內容'],
                topics: ['品牌']
            }
        }
    };
}

test('Vault note writes source id/url and isolates a replication project', async () => {
    const root = await fs.mkdtemp(path.join('/tmp', 'media-vault-'));
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
    assert.equal(result.relative_path, 'wiki/domains/個人品牌/Wallpets 深度研究與複製規劃.md');
    assert.equal(result.replication_path, 'domain/個人品牌/Wallpets 復刻項目/復刻規劃.md');
    const source = await fs.readFile(path.join(root, result.relative_path), 'utf8');
    const replication = await fs.readFile(path.join(root, result.replication_path), 'utf8');
    assert.match(source, /database_post_id: post-123/);
    assert.match(source, /https:\/\/example\.test\/posts\/123/);
    assert.match(source, /完整原文內容/);
    assert.match(replication, /資料庫貼文 ID: post-123/);
    assert.match(replication, /Wallpets 復刻項目/);
});

test('Vault note retry preserves text outside the managed block', async () => {
    const root = await fs.mkdtemp(path.join('/tmp', 'media-vault-'));
    await fs.mkdir(path.join(root, 'wiki'));
    const input = {
        domain: '測試',
        note_title: '保留人工內容',
        original_content: '第一次內容'
    };
    const workflow = fixtureWorkflow();
    workflow.action_plan.actions = [{ type: 'vault_note', status: 'approved' }];
    await writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: input });
    const filePath = path.join(root, 'wiki', 'domains', '測試', '保留人工內容.md');
    await fs.appendFile(filePath, '\n\n## 人工補充\n不要覆蓋我\n');
    workflow.collection_posts.content = '第二次內容';
    await writeWorkflowVaultNotes({ workflow, vaultRoot: root, noteInput: input });
    const content = await fs.readFile(filePath, 'utf8');
    assert.match(content, /第二次內容/);
    assert.match(content, /不要覆蓋我/);
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
        verifyVaultRoot('/tmp/media-vault-path-that-does-not-exist'),
        error => error.code === 'VAULT_NOT_FOUND' && /Ask the user/.test(error.message)
    );
});
