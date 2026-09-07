import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

function text(value, maxLength = 120_000) {
    return String(value ?? '').replace(/\0/g, '').trim().slice(0, maxLength);
}

async function loadExplicitEnvFile(args) {
    const value = option(args, '--env-file');
    if (!value) throw new Error('Use --env-file <path>; this dry-run never loads credentials implicitly.');
    const envFile = path.resolve(value);
    await access(envFile);
    const result = dotenv.config({ path: envFile, override: false, quiet: true });
    if (result.error) throw new Error(`Unable to load explicit environment file: ${result.error.message}`);
}

function outputDirectory(args) {
    const value = option(args, '--output');
    if (!value) throw new Error('Use --output <directory> outside this repository.');
    return path.resolve(value);
}

export function buildAiTitleBackfillManifest(rows, options = {}) {
    const limit = Math.max(1, Number(options.limit) || 10);
    const candidates = (rows || [])
        .filter(post => !text(post.title, 500) && !text(post.collection_post_analysis?.[0]?.generated_title, 80))
        .sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')))
        .slice(0, limit)
        .map(post => {
            const content = text(post.content);
            return {
                post_id: post.id,
                user_id: post.user_id,
                platform: post.platform || 'generic',
                original_url: post.original_url || null,
                created_at: post.created_at || null,
                content_characters: content.length,
                estimated_input_tokens: Math.ceil(content.length / 4),
                estimated_output_tokens: 40
            };
        });
    return {
        generated_at: new Date().toISOString(),
        mode: 'dry_run',
        writes_performed: false,
        model_calls_performed: false,
        candidates,
        estimates: {
            posts: candidates.length,
            input_tokens: candidates.reduce((total, item) => total + item.estimated_input_tokens, 0),
            output_tokens: candidates.reduce((total, item) => total + item.estimated_output_tokens, 0),
            note: 'Token counts are estimates only; provider pricing is intentionally not hard-coded.'
        }
    };
}

async function loadPosts(supabase) {
    const selection = 'id,user_id,platform,original_url,title,content,created_at,collection_post_analysis (generated_title)';
    const preferred = await supabase.from('collection_posts').select(selection).order('created_at', { ascending: true });
    if (!preferred.error) return { rows: preferred.data || [], analysisSchemaAvailable: true };
    if (preferred.error.code !== '42703') throw new Error(`Read-only title audit failed: ${preferred.error.message}`);
    const fallback = await supabase.from('collection_posts').select('id,user_id,platform,original_url,title,content,created_at').order('created_at', { ascending: true });
    if (fallback.error) throw new Error(`Read-only title audit failed: ${fallback.error.message}`);
    return { rows: fallback.data || [], analysisSchemaAvailable: false };
}

async function main(args) {
    await loadExplicitEnvFile(args);
    const output = outputDirectory(args);
    const { supabase } = await import('../../server/supabaseClient.js');
    const loaded = await loadPosts(supabase);
    const manifest = {
        ...buildAiTitleBackfillManifest(loaded.rows, { limit: option(args, '--limit') }),
        analysis_schema_available: loaded.analysisSchemaAvailable
    };
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, 'ai-title-backfill-dry-run.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ ok: true, output, ...manifest.estimates, analysis_schema_available: loaded.analysisSchemaAvailable })}\n`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
    main(process.argv.slice(2)).catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
        process.exitCode = 1;
    });
}
