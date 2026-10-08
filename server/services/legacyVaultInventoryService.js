import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

async function markdownFiles(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
    const nested = await Promise.all(entries.map(async entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) return markdownFiles(target);
        return entry.isFile() && entry.name.endsWith('.md') ? [target] : [];
    }));
    return nested.flat();
}

function classify(relativePath, content) {
    if (/(^|\/)_(index|README)\.md$/i.test(relativePath) || /(^|\/)kanban\//i.test(relativePath) || /source_url:\s*https?:\/\/example\.com\/?\s*$/im.test(content)) return { candidateKind: 'excluded_system', postId: null };
    const postIds = [...content.matchAll(/(?:database_)?post_id:\s*([0-9a-f-]{8,})/ig)].map(match => match[1]);
    if (/^type:\s*knowledge\s*$/im.test(content) || new Set(postIds).size > 1) return { candidateKind: 'topic_candidate', postId: null };
    const postId = postIds[0] || null;
    if (postId || /(^|\/)wiki\/threads\//.test(relativePath) || /貼文-[0-9a-f]{8}/i.test(relativePath)) return { candidateKind: 'post_candidate', postId };
    return { candidateKind: 'topic_candidate', postId: null };
}

export async function buildLegacyVaultInventory({ vaultRoot }) {
    const root = path.resolve(String(vaultRoot || '').trim());
    if (!root) throw new Error('vaultRoot is required');
    const files = await markdownFiles(path.join(root, 'wiki'));
    const inventory = await Promise.all(files.map(async filePath => {
        const [content, stat] = await Promise.all([fs.readFile(filePath, 'utf8'), fs.stat(filePath)]);
        const relativePath = path.relative(root, filePath).split(path.sep).join('/');
        return {
            relativePath,
            sha256: crypto.createHash('sha256').update(content).digest('hex'),
            modifiedAt: stat.mtime.toISOString(),
            ...classify(relativePath, content)
        };
    }));
    return inventory.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
