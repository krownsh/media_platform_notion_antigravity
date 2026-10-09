import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'Media Knowledge';
const EVENT_LOG_START = '<!-- BEGIN MEDIA EVENT LOG -->';
const EVENT_LOG_END = '<!-- END MEDIA EVENT LOG -->';

function text(value, fallback = '') { return String(value ?? '').replace(/\0/g, '').trim() || fallback; }
function segment(value, fallback) {
    return text(value, fallback).normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || fallback;
}
function assertInside(root, target) {
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Local note path escapes the configured Vault root');
}
async function atomicWrite(filePath, content) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
    try { await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 }); await fs.rename(temporary, filePath); }
    finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
}

function escapeManagedMarker(value) {
    return String(value ?? '')
        .replace(/<!-- BEGIN MEDIA EVENT LOG -->/g, '〔BEGIN MEDIA EVENT LOG〕')
        .replace(/<!-- END MEDIA EVENT LOG -->/g, '〔END MEDIA EVENT LOG〕')
        .replace(/\0/g, '')
        .trim();
}

function singleLine(value, fallback = '') {
    return escapeManagedMarker(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
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
    const capturedText = text(post?.content, '（來源未提供可用文字）');
    if (!sourcePayload || typeof sourcePayload !== 'object') return capturedText;
    let payload;
    try {
        payload = JSON.stringify(sourcePayload, null, 2).replace(/\0/g, '');
    } catch {
        return capturedText;
    }
    return `${capturedText}\n\n### 完整擷取結構\n\`\`\`json\n${payload}\n\`\`\``;
}

export async function writeInitialPostCaseFile({ vaultRoot, post, sourceRevisionId, workflowId = null, sourcePayload = null }) {
    const root = path.resolve(text(vaultRoot));
    const marker = await fs.stat(path.join(root, '.obsidian')).catch(() => null);
    if (!marker?.isDirectory()) throw new Error('Configured local media collection is not an initialized Obsidian Vault');
    const postId = text(post?.id); if (!postId) throw new Error('post.id is required');
    const date = text(post?.created_at, new Date().toISOString()).slice(0, 10);
    const displayTime = text(post?.created_at, new Date().toISOString()).slice(11, 16);
    const title = segment(post?.title, `貼文-${postId.slice(0, 8)}`);
    const filename = `${date}｜暫定：${title}｜${segment(postId.slice(0, 8), 'unknown')}.md`;
    const filePath = path.resolve(root, ROOT, 'Posts', 'Inbox', filename); assertInside(root, filePath);
    const relativePath = path.relative(root, filePath).split(path.sep).join('/');
    const content = `---\nschema_version: 1\nnote_kind: media-post-case-file\npost_id: ${postId}\nsource_revision_id: ${text(sourceRevisionId)}\nworkflow_id: ${text(workflowId)}\nsource_url: ${text(post?.original_url)}\nsource_platform: ${text(post?.platform, 'generic')}\ncaptured_at: ${text(post?.created_at)}\ntitle_status: provisional\nprimary_folder: Inbox\nlocal_record_state: pending\n---\n\n# 暫定：${title}\n\n<!-- BEGIN MEDIA CURRENT STATE -->\n## 目前狀態\n- 為何保留：尚待整理\n- 下一步：等待審核\n<!-- END MEDIA CURRENT STATE -->\n\n<!-- BEGIN MEDIA SOURCE SNAPSHOT -->\n## 來源快照\n${renderSourceSnapshot(post, sourcePayload)}\n<!-- END MEDIA SOURCE SNAPSHOT -->\n\n${EVENT_LOG_START}\n## 工作歷程\n### ${date} ${displayTime}｜擷取｜已記錄\n- source_revision_id: ${text(sourceRevisionId)}\n- workflow_id: ${text(workflowId)}\n${EVENT_LOG_END}\n\n## 你的自由筆記\n`;
    await atomicWrite(filePath, content);
    return { relativePath, filePath, checksum: crypto.createHash('sha256').update(content).digest('hex') };
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
