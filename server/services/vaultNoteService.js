import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export const DEFAULT_VAULT_ROOT = path.join(os.homedir(), '.hermes', 'claude-obsidian');
export const VAULT_MANAGED_START = '<!-- BEGIN MEDIA WORKFLOW MANAGED -->';
export const VAULT_MANAGED_END = '<!-- END MEDIA WORKFLOW MANAGED -->';
const MAX_NOTE_INPUT_BYTES = 256 * 1024;
const MAX_SOURCE_CONTENT_LENGTH = 1_000_000;

function boundedText(value, maxLength = 4_000) {
    return String(value ?? '').replace(/\0/g, '').slice(0, maxLength).trim();
}

function escapeManagedMarkers(value) {
    return value
        .replaceAll(VAULT_MANAGED_START, '〔VAULT_MANAGED_START〕')
        .replaceAll(VAULT_MANAGED_END, '〔VAULT_MANAGED_END〕');
}

function yamlText(value) {
    return escapeManagedMarkers(boundedText(value, 1_000).replace(/[\r\n]+/g, ' '));
}

function markdownText(value, maxLength = 20_000) {
    return escapeManagedMarkers(boundedText(value, maxLength).replace(/\r\n/g, '\n'));
}

function safeSegment(value, fallback, label) {
    const raw = boundedText(value, 120).normalize('NFKC');
    const segment = raw
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
        .replace(/[. ]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!segment || segment === '.' || segment === '..') {
        if (fallback) return fallback;
        throw new Error(`${label} is required for a Vault note`);
    }
    return segment;
}

function assertInside(parent, target) {
    const relative = path.relative(parent, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Vault path escapes the configured root: ${target}`);
    }
}

export function resolveVaultRoot(explicitRoot) {
    const configured = explicitRoot || process.env.HERMES_CLAUDE_OBSIDIAN_PATH || DEFAULT_VAULT_ROOT;
    return path.resolve(configured);
}

export async function verifyVaultRoot(explicitRoot) {
    const root = resolveVaultRoot(explicitRoot);
    let stat;
    try {
        stat = await fs.stat(root);
    } catch (error) {
        const missing = new Error(
            `Claude-Obsidian Vault was not found at ${root}. Ask the user to provide the real Vault path, then set HERMES_CLAUDE_OBSIDIAN_PATH.`
        );
        missing.code = error.code === 'ENOENT' ? 'VAULT_NOT_FOUND' : 'VAULT_UNAVAILABLE';
        throw missing;
    }
    if (!stat.isDirectory()) {
        const invalid = new Error(`Configured Claude-Obsidian Vault is not a directory: ${root}`);
        invalid.code = 'VAULT_INVALID';
        throw invalid;
    }

    // A tool checkout normally has .git but no Obsidian/wiki root. Refuse to
    // write there silently; the user must point Hermes at the actual Vault.
    const [obsidian, wiki, git] = await Promise.all([
        fs.stat(path.join(root, '.obsidian')).catch(() => null),
        fs.stat(path.join(root, 'wiki')).catch(() => null),
        fs.stat(path.join(root, '.git')).catch(() => null)
    ]);
    if (!obsidian?.isDirectory() && !wiki?.isDirectory()) {
        if (git) {
            const invalid = new Error(
                `The configured path looks like a tool checkout, not an initialized Obsidian Vault: ${root}`
            );
            invalid.code = 'VAULT_NOT_RECOGNIZED';
            throw invalid;
        }
        const invalid = new Error(
            `The Vault exists but is not initialized (missing .obsidian and wiki): ${root}. Open this directory once as an Obsidian Vault, then run npm run agent:vault:check.`
        );
        invalid.code = 'VAULT_NOT_INITIALIZED';
        throw invalid;
    }
    return root;
}

function postFromWorkflow(workflow) {
    return Array.isArray(workflow?.collection_posts)
        ? workflow.collection_posts[0]
        : workflow?.collection_posts;
}

function analysisFromPost(post) {
    return Array.isArray(post?.collection_post_analysis)
        ? post.collection_post_analysis[0]
        : post?.collection_post_analysis;
}

function capturedContent(post) {
    if (typeof post?.content === 'string' && post.content.length > 0) return post.content;
    const full = post?.full_json && typeof post.full_json === 'object' ? post.full_json : {};
    return full.content || full.text || full.raw_content || '';
}

function actionFromWorkflow(workflow, type) {
    const actions = Array.isArray(workflow?.action_plan?.actions) ? workflow.action_plan.actions : [];
    return actions.find(action => action?.type === type) || null;
}

function hasManagedPostIdentity(content, postId) {
    return content.split(VAULT_MANAGED_START).length - 1 === 1
        && content.split(VAULT_MANAGED_END).length - 1 === 1
        && content.includes(`- database_post_id: ${yamlText(postId)}`);
}

async function readRecordedVaultFile(root, relativePath, expectedPath, postId, kind) {
    const filePath = path.resolve(root, ...relativePath.split('/'));
    assertInside(root, filePath);
    const [realRoot, realFile] = await Promise.all([
        fs.realpath(root),
        fs.realpath(filePath).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
    ]);
    if (!realFile) return null;
    try {
        assertInside(realRoot, realFile);
    } catch (error) {
        error.code = 'VAULT_RECORDED_PATH_INVALID';
        throw error;
    }
    const content = await fs.readFile(realFile, 'utf8');
    if (!hasManagedPostIdentity(content, postId) || (expectedPath && !content.includes(`- source_note: ${expectedPath}`))) {
        const error = new Error(`Recorded ${kind} belongs to a different post or is not a managed note: ${relativePath}`);
        error.code = 'VAULT_RECORDED_PATH_CONFLICT';
        throw error;
    }
    return { relative_path: relativePath, path: filePath };
}

async function recordedWikiPath(root, workflow, postId) {
    const vaultAction = actionFromWorkflow(workflow, 'vault_note');
    const paths = [...new Set([
        workflow?.context?.vault?.relative_path,
        workflow?.context?.vault_sync?.relative_path,
        vaultAction?.outcome?.relative_path
    ].map(value => String(value || '').trim().replace(/\\/g, '/')).filter(Boolean))];
    if (!paths.length) return null;

    const existing = [];
    const missing = [];
    for (const relativePath of paths) {
        if (!relativePath.startsWith('wiki/')) {
            const error = new Error(`Recorded Vault path is outside wiki: ${relativePath}`);
            error.code = 'VAULT_RECORDED_PATH_INVALID';
            throw error;
        }
        const recorded = await readRecordedVaultFile(root, relativePath, null, postId, 'Vault note');
        if (recorded === null) {
            missing.push(relativePath);
            continue;
        }
        existing.push(recorded);
    }
    if (existing.length > 1) {
        const error = new Error(`Recorded Vault paths conflict: ${existing.map(item => item.relative_path).join(', ')}`);
        error.code = 'VAULT_RECORDED_PATH_CONFLICT';
        throw error;
    }
    if (missing.length || existing.length !== 1) {
        const error = new Error(`Recorded Vault note cannot be safely reused: ${[...missing, ...existing.map(item => item.relative_path)].join(', ')}`);
        error.code = 'VAULT_RECORDED_PATH_UNAVAILABLE';
        throw error;
    }
    return existing[0];
}

async function recordedDraftPath(root, workflow, draft, postId, sourcePath) {
    const relativePath = String(
        draft?.relative_path
        || workflow?.context?.vault?.draft_path
        || workflow?.context?.vault_sync?.draft_path
        || ''
    ).trim().replace(/\\/g, '/');
    if (!relativePath) return null;
    if (!relativePath.startsWith('content/drafts/')) {
        const error = new Error(`Recorded draft path is outside content/drafts: ${relativePath}`);
        error.code = 'VAULT_RECORDED_PATH_INVALID';
        throw error;
    }
    const recorded = await readRecordedVaultFile(root, relativePath, sourcePath, postId, 'draft note');
    if (!recorded) {
        const error = new Error(`Recorded draft note cannot be safely reused: ${relativePath}`);
        error.code = 'VAULT_RECORDED_PATH_UNAVAILABLE';
        throw error;
    }
    return recorded;
}

function formatList(items, maxItems = 20) {
    if (!Array.isArray(items)) return '- （無）';
    const values = items.map(item => markdownText(item, 500)).filter(Boolean).slice(0, maxItems);
    return values.length ? values.map(item => `- ${item}`).join('\n') : '- （無）';
}

function buildManagedBlock({ workflow, noteInput, post, analysis, replication }) {
    const sourceContent = markdownText(
        post?.platform === 'image' ? (noteInput.original_content ?? capturedContent(post)) : capturedContent(post),
        MAX_SOURCE_CONTENT_LENGTH
    );
    const summary = markdownText(noteInput.summary ?? analysis?.summary ?? '', 12_000);
    const discussion = markdownText(noteInput.discussion, 20_000);
    const research = markdownText(noteInput.research, 20_000);
    const poc = markdownText(noteInput.poc, 20_000);
    const nextStep = markdownText(noteInput.next_step, 8_000);
    const decision = markdownText(noteInput.decision, 8_000);
    const contentDraft = noteInput.content_draft && typeof noteInput.content_draft === 'object'
        ? noteInput.content_draft
        : null;
    const tags = Array.isArray(noteInput.tags) ? noteInput.tags : analysis?.tags;
    const topics = Array.isArray(noteInput.topics) ? noteInput.topics : analysis?.topics;
    const acceptedTopics = (Array.isArray(noteInput.accepted_topics) ? noteInput.accepted_topics : [])
        .filter((topic) => topic && typeof topic === 'object' && boundedText(topic.id, 160))
        .slice(0, 20);
    const sourceUrl = post?.platform === 'image'
        ? '（圖片上傳，無公開連結）'
        : (post?.original_url || '（無原文連結）');
    const lines = [
        VAULT_MANAGED_START,
        `- workflow_id: ${yamlText(workflow.id)}`,
        `- database_post_id: ${yamlText(post?.id)}`,
        `- source_url: ${yamlText(sourceUrl)}`,
        `- source_platform: ${yamlText(post?.platform || '') || 'unknown'}`,
        `- updated_at: ${new Date().toISOString()}`,
        '',
        '## 來源摘要',
        summary || '（尚未提供摘要）',
        '',
        '## 原文內容',
        sourceContent || '（資料庫沒有可用的原文內容）',
        '',
        '## 分類與標籤',
        `- primary_category: ${yamlText(noteInput.primary_category ?? analysis?.primary_category ?? 'other')}`,
        `- tags: ${Array.isArray(tags) && tags.length ? tags.map(item => yamlText(item, 200)).join('、') : '（無）'}`,
        `- topics: ${Array.isArray(topics) && topics.length ? topics.map(item => yamlText(item, 200)).join('、') : '（無）'}`,
        '',
        '## 已接受的主題關聯',
        ...(acceptedTopics.length ? acceptedTopics.flatMap((topic) => {
            const projectTitle = yamlText(topic.project_title || topic.project?.title || '未指定');
            const domainKey = yamlText(topic.domain_key || '未指定');
            const score = Number.isFinite(Number(topic.score)) ? Math.round(Number(topic.score)) : null;
            return [
                `- topic_id: ${yamlText(topic.id, 160)}`,
                `  title: ${yamlText(topic.title || '未命名主題', 240)}`,
                `  關聯: ${projectTitle} · ${domainKey}${score === null ? '' : ` · ${score} 分`}`,
                `  rationale: ${markdownText(topic.rationale || '（未提供）', 2_000)}`
            ];
        }) : ['（無已接受的主題關聯）']),
        '',
        '## 討論紀錄',
        discussion || '（尚未提供）',
        '',
        '## Research 結果',
        research || '（未執行或尚未整理）',
        '',
        '## POC 結果',
        poc || '（未執行或尚未整理）',
        '',
        '## 後續決策',
        decision || '（尚未提供）',
        '',
        '## 下一步',
        nextStep || '（尚未提供）'
    ];
    if (contentDraft?.body) {
        lines.push(
            '',
            '## 自動改寫草稿',
            `- 格式: ${yamlText(contentDraft.format || '未指定')}`,
            `- 狀態: ${yamlText(contentDraft.status || 'draft')}`,
            `- 依據: ${yamlText(contentDraft.content_basis || 'source_only')}`,
            contentDraft.rewrite_skill?.name ? `- 編稿 Skill: ${yamlText(contentDraft.rewrite_skill.name)}` : '',
            contentDraft.rewrite_skill?.preset ? `- 編稿預設: ${yamlText(contentDraft.rewrite_skill.preset)}` : '',
            `- 發布: ${contentDraft.published ? '已發布' : '未發布（僅草稿）'}`,
            contentDraft.relative_path ? `- 草稿檔案: ${contentDraft.relative_path}` : '',
            '',
            markdownText(contentDraft.body, 30_000)
        );
    }
    if (replication) {
        lines.push(
            '', '## 復刻方案',
            `- 名稱: ${yamlText(replication.project_name || '未命名')}`,
            `- 目標: ${markdownText(replication.goal || '', 12_000) || '（尚未提供）'}`,
            `- MVP: ${markdownText(replication.mvp || '', 12_000) || '（尚未提供）'}`,
            '- 驗收條件:',
            formatList(replication.acceptance_criteria)
        );
    }
    lines.push(VAULT_MANAGED_END);
    return lines.join('\n');
}

function mergeManagedBlock(existing, managed) {
    const startCount = existing.split(VAULT_MANAGED_START).length - 1;
    const endCount = existing.split(VAULT_MANAGED_END).length - 1;
    if (startCount === 0 && endCount === 0) {
        return `${existing.trimEnd()}\n\n${managed}\n`;
    }
    if (startCount !== 1 || endCount !== 1) {
        const error = new Error('Vault note has ambiguous managed-block delimiters and cannot be safely updated');
        error.code = 'VAULT_MANAGED_BLOCK_AMBIGUOUS';
        throw error;
    }
    const start = existing.indexOf(VAULT_MANAGED_START);
    const end = existing.indexOf(VAULT_MANAGED_END, start + VAULT_MANAGED_START.length);
    if (end < start) {
        const error = new Error('Vault note has an invalid managed-block delimiter order');
        error.code = 'VAULT_MANAGED_BLOCK_AMBIGUOUS';
        throw error;
    }
    const afterEnd = end + VAULT_MANAGED_END.length;
    return `${existing.slice(0, start).trimEnd()}\n\n${managed}\n${existing.slice(afterEnd).trimStart()}`.trim() + '\n';
}

async function atomicWrite(filePath, content) {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
    try {
        await fs.writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        await fs.rename(temporaryPath, filePath);
    } finally {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
    }
}

export function buildVaultNotePaths(root, noteInput, post, _options = {}) {
    const allowedPlatforms = new Set(['instagram', 'facebook', 'twitter', 'threads', 'generic', 'notion', 'youtube', 'github', 'image']);
    const platform = allowedPlatforms.has(String(post?.platform || '').toLowerCase())
        ? String(post.platform).toLowerCase()
        : 'generic';
    const noteTitle = safeSegment(noteInput.note_title || post?.title || analysisFromPost(post)?.generated_title, `貼文-${post?.id?.slice(0, 8) || '未命名'}`, 'note_title');
    const postDate = String(post?.posted_at || post?.created_at || new Date().toISOString()).slice(0, 10);
    const postId = safeSegment(String(post?.id || '').slice(0, 8), 'unknown', 'post id');
    const wikiPath = path.resolve(root, 'wiki', 'threads', platform, `${postDate}-${noteTitle}--${postId}.md`);
    assertInside(root, wikiPath);
    return {
        platform,
        note_title: noteTitle,
        wiki: {
            relative_path: path.relative(root, wikiPath).split(path.sep).join('/'),
            path: wikiPath
        },
        replication: null
    };
}

export async function writeWorkflowVaultNotes({ workflow, noteInput = {}, vaultRoot } = {}) {
    if (!workflow?.id) throw new Error('workflow is required to write a Vault note');
    const root = await verifyVaultRoot(vaultRoot);
    const post = postFromWorkflow(workflow);
    if (!post?.id) throw new Error('Workflow post is required to write a Vault note');
    const analysis = analysisFromPost(post);
    const replicationAction = actionFromWorkflow(workflow, 'replication_plan');
    const effectiveNoteInput = replicationAction && !noteInput.replication
        ? {
            ...noteInput,
            replication: {
                project_name: replicationAction.project_name || noteInput.replication_project,
                goal: replicationAction.goal,
                mvp: replicationAction.mvp,
                acceptance_criteria: replicationAction.acceptance_criteria
            }
        }
        : noteInput;
    const plannedPaths = buildVaultNotePaths(root, effectiveNoteInput, post);
    const existingPath = await recordedWikiPath(root, workflow, post.id);
    const paths = existingPath ? { ...plannedPaths, wiki: existingPath } : plannedPaths;
    const replication = effectiveNoteInput.replication && typeof effectiveNoteInput.replication === 'object'
        ? effectiveNoteInput.replication
        : null;
    const draft = effectiveNoteInput.content_draft && typeof effectiveNoteInput.content_draft === 'object'
        ? effectiveNoteInput.content_draft
        : null;
    let draftPath = null;
    let draftFile = null;
    let draftFormat = null;
    let draftTitle = null;
    if (draft?.body) {
        const existingDraft = await recordedDraftPath(root, workflow, draft, post.id, paths.wiki.relative_path);
        if (existingDraft) {
            draftFile = existingDraft.path;
            draftPath = existingDraft.relative_path;
        } else {
            draftFormat = safeSegment(draft.format || 'draft', 'draft', 'draft format');
            draftTitle = safeSegment(`${draft.title || paths.note_title}-${post.id.slice(0, 8)}`, paths.note_title, 'draft title');
            draftFile = path.resolve(root, 'content', 'drafts', paths.platform, draftFormat, `${draftTitle}.md`);
            assertInside(root, draftFile);
            draftPath = path.relative(root, draftFile).split(path.sep).join('/');
        }
        effectiveNoteInput.content_draft.relative_path = draftPath;
    }
    const wikiManaged = buildManagedBlock({ workflow, noteInput: effectiveNoteInput, post, analysis, replication });
    const existingWiki = await fs.readFile(paths.wiki.path, 'utf8').catch(error => (error.code === 'ENOENT' ? '' : Promise.reject(error)));
    if (existingWiki && !hasManagedPostIdentity(existingWiki, post.id)) {
        const error = new Error(`Vault note path is occupied by an unmanaged note: ${paths.wiki.relative_path}`);
        error.code = 'VAULT_NOTE_PATH_CONFLICT';
        throw error;
    }
    await atomicWrite(paths.wiki.path, mergeManagedBlock(existingWiki, wikiManaged));

    if (draft?.body) {
        const draftManaged = [
            VAULT_MANAGED_START,
            '## 草稿內容',
            markdownText(draft.body, 30_000),
            '',
            VAULT_MANAGED_END,
            ''
        ].join('\n');
        const draftNote = [
            `# ${draftTitle}`,
            '',
            `- workflow_id: ${yamlText(workflow.id)}`,
            `- database_post_id: ${yamlText(post.id)}`,
            `- format: ${draftFormat}`,
            `- status: ${yamlText(draft.status || 'draft')}`,
            `- content_basis: ${yamlText(draft.content_basis || 'source_only')}`,
            `- published: ${draft.published ? 'true' : 'false'}`,
            `- source_note: ${paths.wiki.relative_path}`,
            '',
            draftManaged
        ].join('\n');
        const existingDraft = await fs.readFile(draftFile, 'utf8').catch(error => (error.code === 'ENOENT' ? '' : Promise.reject(error)));
        if (existingDraft && !hasManagedPostIdentity(existingDraft, post.id)) {
            const error = new Error(`Draft path is occupied by an unmanaged note: ${draftPath}`);
            error.code = 'VAULT_NOTE_PATH_CONFLICT';
            throw error;
        }
        await atomicWrite(draftFile, existingDraft ? mergeManagedBlock(existingDraft, draftManaged) : draftNote);
    }

    return {
        post_id: post.id,
        workflow_id: workflow.id,
        vault_root: root,
        relative_path: paths.wiki.relative_path,
        replication_path: null,
        draft_path: draftPath,
        note_title: paths.note_title,
        platform: paths.platform,
        source_url: post.platform === 'image' ? null : (post.original_url || null),
        content_length: capturedContent(post).length
    };
}

export function assertNoteInputSize(raw) {
    if (Buffer.byteLength(String(raw || ''), 'utf8') > MAX_NOTE_INPUT_BYTES) {
        throw new Error(`Vault note input must be ${MAX_NOTE_INPUT_BYTES} bytes or smaller`);
    }
}
