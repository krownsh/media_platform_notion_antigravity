import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { verifyVaultRoot } from '../../server/services/vaultNoteService.js';

function one(value) {
    return Array.isArray(value) ? value[0] || null : value || null;
}

function safeRelative(value) {
    const relative = String(value || '').trim().replace(/\\/g, '/');
    if (!relative.startsWith('wiki/') || relative.split('/').some(part => !part || part === '.' || part === '..')) return null;
    return relative;
}

function safeSegment(value, fallback) {
    const result = String(value || '').normalize('NFKC')
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
        .replace(/[. ]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return result || fallback;
}

function absolute(root, relative) {
    const target = path.resolve(root, ...relative.split('/'));
    const inside = path.relative(root, target);
    if (inside.startsWith('..') || path.isAbsolute(inside)) throw new Error(`Vault path escapes root: ${relative}`);
    return target;
}

async function sha256(filePath) {
    return crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

function workflowPath(workflow) {
    const action = Array.isArray(workflow?.action_plan?.actions)
        ? workflow.action_plan.actions.find(item => item?.type === 'vault_note')
        : null;
    return [
        workflow?.context?.vault?.relative_path,
        workflow?.context?.vault_sync?.relative_path,
        action?.outcome?.relative_path
    ].map(safeRelative).find(Boolean) || null;
}

function targetPath(workflow, oldPath) {
    const post = one(workflow.collection_posts);
    const collection = one(post?.collection_collections);
    const directory = collection?.name
        ? `wiki/collections/${safeSegment(collection.name, '未命名資料夾')}`
        : 'wiki/inbox';
    return `${directory}/${path.posix.basename(oldPath)}`;
}

function replacePath(workflow, oldPath, newPath) {
    const context = structuredClone(workflow.context || {});
    const actionPlan = structuredClone(workflow.action_plan || {});
    let changed = false;
    for (const key of ['vault', 'vault_sync']) {
        if (context[key]?.relative_path === oldPath) {
            context[key].relative_path = newPath;
            changed = true;
        }
    }
    for (const action of Array.isArray(actionPlan.actions) ? actionPlan.actions : []) {
        if (action?.type === 'vault_note' && action?.outcome?.relative_path === oldPath) {
            action.outcome.relative_path = newPath;
            changed = true;
        }
    }
    if (!changed) throw new Error(`Workflow ${workflow.id} no longer records ${oldPath}`);
    return { context, action_plan: actionPlan };
}

export async function planVaultContentMigration({ workflows, vaultRoot }) {
    const root = path.resolve(vaultRoot);
    const rows = [];
    for (const workflow of workflows || []) {
        const old_relative_path = workflowPath(workflow);
        const base = {
            workflow_id: workflow.id,
            user_id: workflow.user_id,
            post_id: workflow.post_id,
            expected_updated_at: workflow.updated_at,
            old_relative_path
        };
        if (!old_relative_path?.startsWith('wiki/domains/')) {
            rows.push({ ...base, status: 'skipped', reason: 'not_a_legacy_domain_path' });
            continue;
        }
        const new_relative_path = targetPath(workflow, old_relative_path);
        const source = absolute(root, old_relative_path);
        const destination = absolute(root, new_relative_path);
        const sourceStat = await fs.stat(source).catch(() => null);
        if (!sourceStat?.isFile()) {
            rows.push({ ...base, new_relative_path, status: 'skipped', reason: 'old_file_missing' });
            continue;
        }
        if (await fs.stat(destination).catch(() => null)) {
            rows.push({ ...base, new_relative_path, status: 'skipped', reason: 'target_already_exists' });
            continue;
        }
        rows.push({ ...base, new_relative_path, old_sha256: await sha256(source), status: 'ready', reason: 'verified' });
    }
    return { version: 1, generated_at: new Date().toISOString(), vault_root: root, rows };
}

async function currentWorkflow(supabase, row) {
    const { data, error } = await supabase.from('collection_post_workflows')
        .select('id,user_id,updated_at,context,action_plan')
        .eq('id', row.workflow_id)
        .eq('user_id', row.user_id)
        .maybeSingle();
    if (error || !data) throw new Error(`Workflow ${row.workflow_id} changed or is unavailable: ${error?.message || 'no row'}`);
    if (data.updated_at !== row.expected_updated_at) throw new Error(`Workflow ${row.workflow_id} changed after the manifest was created`);
    return data;
}

export async function applyVaultContentMigration({ manifest, vaultRoot, supabase }) {
    const root = path.resolve(vaultRoot);
    if (path.resolve(manifest.vault_root || '') !== root) throw new Error('Manifest Vault root does not match --vault');
    const results = [];
    for (const row of manifest.rows || []) {
        if (row.status !== 'ready') {
            results.push({ workflow_id: row.workflow_id, status: 'skipped', reason: row.reason });
            continue;
        }
        const source = absolute(root, row.old_relative_path);
        const destination = absolute(root, row.new_relative_path);
        let copied = false;
        let databaseUpdated = false;
        try {
            if ((await sha256(source)) !== row.old_sha256) throw new Error('old file changed after manifest was created');
            if (await fs.stat(destination).catch(() => null)) throw new Error('target already exists');
            const workflow = await currentWorkflow(supabase, row);
            const update = replacePath(workflow, row.old_relative_path, row.new_relative_path);
            await fs.mkdir(path.dirname(destination), { recursive: true });
            await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
            copied = true;
            const { data, error } = await supabase.from('collection_post_workflows')
                .update(update)
                .eq('id', row.workflow_id)
                .eq('user_id', row.user_id)
                .eq('updated_at', row.expected_updated_at)
                .select('id')
                .maybeSingle();
            if (error || !data) throw new Error(`database path update failed: ${error?.message || 'no row'}`);
            databaseUpdated = true;
            await fs.rm(source);
            results.push({ workflow_id: row.workflow_id, status: 'moved', new_relative_path: row.new_relative_path });
        } catch (error) {
            if (copied && !databaseUpdated) await fs.rm(destination, { force: true }).catch(() => {});
            results.push({
                workflow_id: row.workflow_id,
                status: databaseUpdated ? 'db_updated_old_file_retained' : 'failed',
                error: error.message
            });
        }
    }
    return { ok: results.every(row => row.status === 'moved' || row.status === 'skipped'), results };
}

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

async function main() {
    const args = process.argv.slice(2);
    const vault = option(args, '--vault');
    const manifestPath = option(args, '--manifest');
    if (!vault) throw new Error('Use --vault <actual-obsidian-vault>.');
    const vaultRoot = await verifyVaultRoot(vault);
    if (manifestPath) {
        if (!args.includes('--apply')) throw new Error('Applying a manifest requires --apply.');
        const manifest = JSON.parse(await fs.readFile(path.resolve(manifestPath), 'utf8'));
        const { supabase } = await import('../../server/supabaseClient.js');
        const result = await applyVaultContentMigration({ manifest, vaultRoot, supabase });
        process.stdout.write(`${JSON.stringify(result)}\n`);
        if (!result.ok) process.exitCode = 1;
        return;
    }
    const userId = option(args, '--user-id');
    const output = option(args, '--output');
    if (!userId || !output) throw new Error('Dry run requires --user-id <uuid> and --output <directory>.');
    const { supabase } = await import('../../server/supabaseClient.js');
    const { data, error } = await supabase.from('collection_post_workflows')
        .select('id,user_id,post_id,updated_at,context,action_plan,collection_posts (id, collection_id, collection_collections (id, name))')
        .eq('user_id', userId);
    if (error) throw new Error(`Vault migration read failed: ${error.message}`);
    const manifest = await planVaultContentMigration({ workflows: data || [], vaultRoot });
    const outputPath = path.resolve(output, 'vault-content-migration-plan.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ ok: true, output: outputPath, ready: manifest.rows.filter(row => row.status === 'ready').length, skipped: manifest.rows.filter(row => row.status === 'skipped').length })}\n`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    const envFile = option(process.argv.slice(2), '--env-file');
    if (envFile) dotenv.config({ path: path.resolve(envFile), override: false, quiet: true });
    main().catch(error => { process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`); process.exitCode = 1; });
}
