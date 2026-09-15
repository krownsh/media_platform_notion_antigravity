import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

function boundedLimit(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 25;
    return Math.max(1, Math.min(100, Math.floor(number)));
}

function reject(workflow, reason) {
    return {
        workflow_id: workflow.id,
        outbox_event_id: workflow.outbox_event_id || null,
        reason
    };
}

export function buildOutboxAckRepairManifest(workflows, options = {}) {
    const generatedAt = new Date(options.now || new Date()).toISOString();
    const ack_candidates = [];
    const rejected = [];
    let already_acknowledged = 0;

    for (const workflow of workflows || []) {
        const event = workflow?.collection_capture_outbox || null;
        if (!workflow?.id || !workflow.outbox_event_id) {
            rejected.push(reject(workflow || {}, 'workflow_outbox_reference_missing'));
        } else if (!event) {
            rejected.push(reject(workflow, 'outbox_not_found'));
        } else if (event.id !== workflow.outbox_event_id) {
            rejected.push(reject(workflow, 'event_mismatch'));
        } else if (event.user_id !== workflow.user_id) {
            rejected.push(reject(workflow, 'user_mismatch'));
        } else if (event.aggregate_id !== workflow.post_id) {
            rejected.push(reject(workflow, 'post_mismatch'));
        } else if (event.status === 'sent') {
            already_acknowledged += 1;
        } else if (event.status !== 'pending') {
            rejected.push(reject(workflow, 'outbox_not_pending'));
        } else {
            ack_candidates.push({
                workflow_id: workflow.id,
                outbox_event_id: event.id,
                user_id: workflow.user_id,
                post_id: workflow.post_id,
                workflow_stage: workflow.stage || null,
                workflow_status: workflow.status || null,
                outbox_status: event.status,
                action: 'acknowledge_as_sent',
                reason: 'workflow_persisted_but_outbox_ack_missing'
            });
        }
    }

    return {
        generated_at: generatedAt,
        mode: 'dry_run',
        writes_performed: false,
        acknowledgement_actions_performed: false,
        ack_candidates,
        rejected,
        summary: {
            inspected: (workflows || []).length,
            candidates: ack_candidates.length,
            rejected: rejected.length,
            already_acknowledged
        },
        next_step: 'Review ack_candidates. This tool never writes; any repair requires an explicit approved list, backup, and a separate authorized operation.'
    };
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
    const output = path.resolve(value);
    if (!path.relative(projectRoot, output).startsWith('..')) {
        throw new Error('Dry-run output must be outside this repository.');
    }
    return output;
}

async function loadWorkflowsWithOutbox(supabase, limit) {
    const { data: workflows, error } = await supabase
        .from('collection_post_workflows')
        .select('id,user_id,post_id,outbox_event_id,stage,status,updated_at')
        .not('outbox_event_id', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(limit);
    if (error) throw new Error(`Read-only workflow audit failed: ${error.message}`);

    return Promise.all((workflows || []).map(async workflow => {
        const { data: event, error: eventError } = await supabase
            .from('collection_capture_outbox')
            .select('id,user_id,aggregate_id,status,locked_at,locked_by,last_error,updated_at')
            .eq('id', workflow.outbox_event_id)
            .maybeSingle();
        if (eventError) throw new Error(`Read-only Outbox audit failed for ${workflow.outbox_event_id}: ${eventError.message}`);
        return { ...workflow, collection_capture_outbox: event || null };
    }));
}

async function main(args) {
    await loadExplicitEnvFile(args);
    const output = outputDirectory(args);
    const { supabase } = await import('../../server/supabaseClient.js');
    const workflows = await loadWorkflowsWithOutbox(supabase, boundedLimit(option(args, '--limit')));
    const manifest = buildOutboxAckRepairManifest(workflows);
    await mkdir(output, { recursive: true });
    const outputFile = path.join(output, 'outbox-ack-repair-dry-run.json');
    await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ ok: true, output_file: outputFile, ...manifest.summary })}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main(process.argv.slice(2)).catch(error => {
        process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
        process.exitCode = 1;
    });
}
