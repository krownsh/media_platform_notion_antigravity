import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'Media Knowledge';
const EVENT_LOG_START = '<!-- BEGIN MEDIA EVENT LOG -->';
const EVENT_LOG_END = '<!-- END MEDIA EVENT LOG -->';

function text(value, fallback = '') {
    const raw = String(value ?? '');
    const wellFormed = typeof raw.toWellFormed === 'function' ? raw.toWellFormed() : raw;
    return wellFormed.replace(/\0/g, '').trim() || fallback;
}
function segment(value, fallback) {
    return text(value, fallback).normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || fallback;
}
function assertInside(root, target) {
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Local note path escapes the configured Vault root');
}
async function atomicWrite(filePath, content, { replace = true } = {}) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
    try {
        await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        if (replace) await fs.rename(temporary, filePath);
        else {
            await fs.link(temporary, filePath);
            await fs.unlink(temporary);
        }
    }
    finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
}

function escapeManagedMarker(value) {
    const raw = String(value ?? '');
    const wellFormed = typeof raw.toWellFormed === 'function' ? raw.toWellFormed() : raw;
    return wellFormed
        .replace(/<!-- BEGIN MEDIA EVENT LOG -->/g, '〔BEGIN MEDIA EVENT LOG〕')
        .replace(/<!-- END MEDIA EVENT LOG -->/g, '〔END MEDIA EVENT LOG〕')
        .replace(/\0/g, '')
        .trim();
}

function singleLine(value, fallback = '') {
    return escapeManagedMarker(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
}

function headlineText(value) {
    return singleLine(value)
        .replace(/^[-–—•·#]+\s*/, '')
        .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s]+/u, '')
        .replace(/^['“”"「」]+|['“”"「」]+$/g, '')
        .trim();
}

function firstMeaningfulSentence(value) {
    const normalized = headlineText(value)
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!normalized) return '';
    const sentence = normalized.split(/[。！？!?]+/)[0].trim();
    if (!sentence) return '';
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length > 12 && /[A-Za-z]/.test(sentence)) return words.slice(0, 12).join(' ');
    return sentence.slice(0, 72).replace(/[，、,:;；]\s*$/u, '').trim();
}

function conciseTitle(value) {
    const normalized = headlineText(value);
    if (!normalized) return '';
    const firstSentence = normalized.split(/[。！？!?]+/)[0].trim();
    const hasCjk = /[\u3400-\u9fff]/u.test(firstSentence);
    if (!hasCjk) return firstSentence.split(/\s+/).filter(Boolean).slice(0, 12).join(' ');
    if (firstSentence.length <= 56) return firstSentence;
    const beforeLimit = firstSentence.slice(0, 57);
    const boundaries = [...beforeLimit.matchAll(/\s+/g)]
        .map(match => match.index)
        .filter(index => index >= 20);
    const leadingName = firstSentence.match(/^[\u3400-\u9fff]{2,3}/u)?.[0] || null;
    const repeatedTitleBoundary = leadingName
        ? boundaries.find(index => firstSentence.slice(index).trimStart().startsWith(leadingName))
        : undefined;
    if (repeatedTitleBoundary !== undefined) return firstSentence.slice(0, repeatedTitleBoundary).trim();
    const boundary = boundaries.at(-1);
    return (boundary === undefined ? beforeLimit : beforeLimit.slice(0, boundary))
        .replace(/[，、,:;；]\s*$/u, '').trim();
}

function platformLabel(platform) {
    return ({
        twitter: 'X', threads: 'Threads', instagram: 'Instagram', facebook: 'Facebook',
        youtube: 'YouTube', github: 'GitHub', image: '圖片', notion: 'Notion', generic: '網頁'
    })[String(platform || '').toLowerCase()] || '貼文';
}

export function deriveProvisionalPostTitle(post = {}, sourcePayload = null) {
    const payloadPost = sourcePayload && typeof sourcePayload === 'object' ? sourcePayload.post || {} : {};
    const explicit = conciseTitle(post.title || payloadPost.title);
    if (explicit) return explicit.slice(0, 120);
    const derived = firstMeaningfulSentence(post.content || payloadPost.content);
    if (derived) return derived.slice(0, 120);
    return `${platformLabel(post.platform || payloadPost.platform)} 貼文（來源待修復）`;
}

function managedMarkerIndex(content, marker, label) {
    const first = content.indexOf(marker);
    if (first < 0 || first !== content.lastIndexOf(marker)) {
        throw new Error(`Post case file has an invalid ${label} marker`);
    }
    return first;
}

async function resolveExistingPostCaseFile(root, relativePath) {
    const normalized = String(relativePath ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized.startsWith(`${ROOT}/Posts/`)) {
        throw new Error('Post case file must be inside Media Knowledge/Posts');
    }
    const candidate = path.resolve(root, ...normalized.split('/'));
    assertInside(root, candidate);
    const [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(candidate)]);
    assertInside(realRoot, realFile);
    return { relativePath: path.relative(root, candidate).split(path.sep).join('/'), filePath: realFile };
}

function eventStatusLabel(status) {
    return ({ candidate: '候選', accepted: '已接受', rejected: '已拒絕', recorded: '已記錄', failed: '失敗', superseded: '已取代' })[status] || '已記錄';
}

function renderEvent(event) {
    const occurredAt = singleLine(event?.occurredAt, new Date().toISOString());
    const timestamp = new Date(occurredAt);
    const date = Number.isNaN(timestamp.valueOf()) ? occurredAt.slice(0, 10) : timestamp.toISOString().slice(0, 10);
    const time = Number.isNaN(timestamp.valueOf()) ? occurredAt.slice(11, 16) : timestamp.toISOString().slice(11, 16);
    const type = singleLine(event?.type, 'event');
    const status = singleLine(event?.status, 'recorded');
    const lines = [
        `### ${date} ${time}｜${type}｜${eventStatusLabel(status)}`,
        `- event_id: ${singleLine(event?.eventId, crypto.randomUUID())}`,
        `- actor: ${singleLine(event?.actor, 'system')}`,
        `- status: ${status}`
    ];
    if (event?.legacyPath) lines.push(`- legacy_path: ${singleLine(event.legacyPath)}`);
    if (event?.conclusion) lines.push('', '#### 本次結論', escapeManagedMarker(event.conclusion));
    return `${lines.join('\n')}\n`;
}

function renderSourceSnapshot(post, sourcePayload) {
    const payloadPost = sourcePayload && typeof sourcePayload === 'object' ? sourcePayload.post || {} : {};
    const capturedText = text(post?.content) || text(payloadPost?.content, '（來源未提供可用文字）');
    if (!sourcePayload || typeof sourcePayload !== 'object') return capturedText;
    const media = Array.isArray(sourcePayload.media) ? sourcePayload.media : [];
    const comments = Array.isArray(sourcePayload.comments) ? sourcePayload.comments : [];
    const sections = [capturedText];
    const mediaLines = media.map(item => {
        const url = singleLine(item?.url);
        if (!url) return null;
        const label = singleLine(item?.alt_text || item?.type, '媒體');
        return `- ${label}：${url}`;
    }).filter(Boolean);
    if (mediaLines.length) sections.push(`### 媒體參考\n${mediaLines.join('\n')}`);
    const commentLines = comments.map(item => {
        const body = singleLine(item?.content);
        if (!body) return null;
        return `- ${singleLine(item?.author_name, '未具名')}：${body}`;
    }).filter(Boolean);
    if (commentLines.length) sections.push(`### 來源留言\n${commentLines.join('\n')}`);
    return sections.join('\n\n');
}

function renderCaptureRevisionEvent({ post, sourceRevisionId, workflowId = null, sourcePayload = null, captureQuality = 'complete', occurredAt = null }) {
    const timestamp = new Date(text(occurredAt, new Date().toISOString()));
    const date = Number.isNaN(timestamp.valueOf()) ? text(occurredAt).slice(0, 10) : timestamp.toISOString().slice(0, 10);
    const time = Number.isNaN(timestamp.valueOf()) ? text(occurredAt).slice(11, 16) : timestamp.toISOString().slice(11, 16);
    const sourceQualityLabel = captureQuality === 'partial' ? '部分擷取' : '完整擷取';
    return [
        `### ${date} ${time}｜擷取修訂｜已記錄`,
        `- source_revision_id: ${text(sourceRevisionId)}`,
        `- workflow_id: ${text(workflowId)}`,
        `- 來源完整度：${sourceQualityLabel}`,
        '',
        '#### 新增來源快照',
        `- source_url: ${singleLine(post?.original_url, '（來源網址未提供）')}`,
        '',
        renderSourceSnapshot(post, sourcePayload)
    ].join('\n') + '\n';
}

export async function writeInitialPostCaseFile({ vaultRoot, post, sourceRevisionId, workflowId = null, sourcePayload = null, captureQuality = 'complete' }) {
    const root = path.resolve(text(vaultRoot));
    const marker = await fs.stat(path.join(root, '.obsidian')).catch(() => null);
    if (!marker?.isDirectory()) throw new Error('Configured local media collection is not an initialized Obsidian Vault');
    const postId = text(post?.id); if (!postId) throw new Error('post.id is required');
    const date = text(post?.created_at, new Date().toISOString()).slice(0, 10);
    const displayTime = text(post?.created_at, new Date().toISOString()).slice(11, 16);
    const title = segment(deriveProvisionalPostTitle(post, sourcePayload), `貼文-${postId.slice(0, 8)}`);
    const partial = captureQuality === 'partial';
    const sourceQualityLabel = partial ? '部分擷取' : '完整擷取';
    const nextAction = partial ? '開始內容討論或修復來源' : '開始內容討論';
    const filename = `${date}｜暫定：${title}｜${segment(postId.slice(0, 8), 'unknown')}.md`;
    const filePath = path.resolve(root, ROOT, 'Posts', 'Inbox', filename); assertInside(root, filePath);
    const relativePath = path.relative(root, filePath).split(path.sep).join('/');
    const content = `---\nschema_version: 1\nnote_kind: media-post-case-file\npost_id: ${postId}\nsource_revision_id: ${text(sourceRevisionId)}\nworkflow_id: ${text(workflowId)}\nsource_url: ${text(post?.original_url)}\nsource_platform: ${text(post?.platform, 'generic')}\ncaptured_at: ${text(post?.created_at)}\ntitle_status: provisional\nprimary_folder: Inbox\nlocal_record_state: inbox_ready\nsource_quality: ${captureQuality}\n---\n\n# 暫定：${title}\n\n<!-- BEGIN MEDIA CURRENT STATE -->\n## 目前狀態\n- 為何保留：原始來源已保存，尚待討論\n- 來源完整度：${sourceQualityLabel}\n- 下一步：${nextAction}\n<!-- END MEDIA CURRENT STATE -->\n\n<!-- BEGIN MEDIA SOURCE SNAPSHOT -->\n## 來源快照\n${renderSourceSnapshot(post, sourcePayload)}\n<!-- END MEDIA SOURCE SNAPSHOT -->\n\n${EVENT_LOG_START}\n## 工作歷程\n### ${date} ${displayTime}｜擷取｜已記錄\n- source_revision_id: ${text(sourceRevisionId)}\n- workflow_id: ${text(workflowId)}\n- 來源完整度：${sourceQualityLabel}\n${EVENT_LOG_END}\n\n## 你的自由筆記\n`;
    try {
        await atomicWrite(filePath, content, { replace: false });
    } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        const existing = await fs.readFile(filePath, 'utf8');
        if (!existing.includes(`post_id: ${postId}\n`)) {
            throw new Error('Existing Inbox case file belongs to a different post');
        }
        return { relativePath, filePath, checksum: crypto.createHash('sha256').update(existing).digest('hex') };
    }
    return { relativePath, filePath, checksum: crypto.createHash('sha256').update(content).digest('hex') };
}

export async function rehomePostCaseFileToInbox({ vaultRoot, relativePath, post, sourcePayload = null }) {
    const root = path.resolve(text(vaultRoot));
    const marker = await fs.stat(path.join(root, '.obsidian')).catch(() => null);
    if (!marker?.isDirectory()) throw new Error('Configured local media collection is not an initialized Obsidian Vault');
    const postId = text(post?.id);
    if (!postId) throw new Error('post.id is required');
    const date = text(post?.created_at, new Date().toISOString()).slice(0, 10);
    const title = segment(deriveProvisionalPostTitle(post, sourcePayload), `貼文-${postId.slice(0, 8)}`);
    const filename = `${date}｜暫定：${title}｜${segment(postId.slice(0, 8), 'unknown')}.md`;
    const destinationPath = path.resolve(root, ROOT, 'Posts', 'Inbox', filename);
    assertInside(root, destinationPath);
    const destinationRelativePath = path.relative(root, destinationPath).split(path.sep).join('/');
    let existing;
    try {
        existing = await resolveExistingPostCaseFile(root, relativePath);
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        const recovered = await fs.readFile(destinationPath, 'utf8').catch(() => null);
        if (!recovered || !recovered.includes(`post_id: ${postId}\n`)) throw error;
        return {
            relativePath: destinationRelativePath,
            filePath: destinationPath,
            checksum: crypto.createHash('sha256').update(recovered).digest('hex'),
            moved: false,
            recovered: true
        };
    }
    const existingContent = await fs.readFile(existing.filePath, 'utf8');
    if (!existingContent.includes(`post_id: ${postId}\n`)) {
        throw new Error('Existing post case file belongs to a different post');
    }
    if (existing.relativePath.startsWith(`${ROOT}/Posts/Inbox/`)) {
        return {
            relativePath: existing.relativePath,
            filePath: existing.filePath,
            checksum: crypto.createHash('sha256').update(existingContent).digest('hex'),
            moved: false,
            recovered: false
        };
    }
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    let linked = false;
    try {
        await fs.link(existing.filePath, destinationPath);
        linked = true;
        await fs.unlink(existing.filePath);
    } catch (error) {
        if (linked) await fs.unlink(destinationPath).catch(() => {});
        if (error?.code === 'EEXIST') {
            throw new Error('Inbox destination already exists; refusing to create a duplicate post case file');
        }
        throw error;
    }
    return {
        relativePath: destinationRelativePath,
        filePath: destinationPath,
        checksum: crypto.createHash('sha256').update(existingContent).digest('hex'),
        moved: true
    };
}

export async function appendPostCaseFileCaptureRevision({
    vaultRoot,
    relativePath,
    post,
    sourceRevisionId,
    workflowId = null,
    sourcePayload = null,
    captureQuality = 'complete',
    occurredAt = null
}) {
    const root = path.resolve(text(vaultRoot));
    const marker = await fs.stat(path.join(root, '.obsidian')).catch(() => null);
    if (!marker?.isDirectory()) throw new Error('Configured local media collection is not an initialized Obsidian Vault');
    if (!text(sourceRevisionId)) throw new Error('sourceRevisionId is required');
    const target = await resolveExistingPostCaseFile(root, relativePath);
    const current = await fs.readFile(target.filePath, 'utf8');
    const postId = text(post?.id);
    if (!postId || !current.includes(`post_id: ${postId}\n`)) {
        throw new Error('Existing post case file belongs to a different post');
    }
    const start = managedMarkerIndex(current, EVENT_LOG_START, 'event-log start');
    const end = managedMarkerIndex(current, EVENT_LOG_END, 'event-log end');
    if (end <= start) throw new Error('Post case file event-log markers are out of order');
    const revision = renderCaptureRevisionEvent({ post, sourceRevisionId, workflowId, sourcePayload, captureQuality, occurredAt });
    const next = `${current.slice(0, end).replace(/\n?$/, '\n')}\n${revision}${current.slice(end)}`;
    await atomicWrite(target.filePath, next);
    return {
        relativePath: target.relativePath,
        checksum: crypto.createHash('sha256').update(next).digest('hex')
    };
}

export async function appendPostCaseFileEvent({ vaultRoot, relativePath, event }) {
    const root = path.resolve(text(vaultRoot));
    const marker = await fs.stat(path.join(root, '.obsidian')).catch(() => null);
    if (!marker?.isDirectory()) throw new Error('Configured local media collection is not an initialized Obsidian Vault');
    const target = await resolveExistingPostCaseFile(root, relativePath);
    const current = await fs.readFile(target.filePath, 'utf8');
    const start = managedMarkerIndex(current, EVENT_LOG_START, 'event-log start');
    const end = managedMarkerIndex(current, EVENT_LOG_END, 'event-log end');
    if (end <= start) throw new Error('Post case file event-log markers are out of order');
    const next = `${current.slice(0, end).replace(/\n?$/, '\n')}\n${renderEvent(event)}${current.slice(end)}`;
    await atomicWrite(target.filePath, next);
    return {
        relativePath: target.relativePath,
        checksum: crypto.createHash('sha256').update(next).digest('hex')
    };
}
