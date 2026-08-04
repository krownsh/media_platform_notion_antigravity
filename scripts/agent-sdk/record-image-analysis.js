import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { recordHermesImageAnalysis } from '../../server/services/hermesImageAnalysisService.js';
import { markAnalysisProvenance, markImageWorkflowAnalyzed } from '../../server/services/postWorkflowService.js';
import {
    completeHermesImageReview,
    requireHermesImageLease
} from '../../server/services/hermesOutboxService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

function readOption(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
}

async function main() {
    const args = process.argv.slice(2);
    const outboxId = args[0];
    const inputFile = readOption(args, '--file');
    const agentIdentity = readOption(args, '--agent');
    if (!inputFile) throw new Error('--file <analysis.json> is required');

    const raw = await readFile(path.resolve(inputFile), 'utf8');
    if (Buffer.byteLength(raw) > 128 * 1024) throw new Error('Image analysis JSON must be 128 KB or smaller');
    const result = JSON.parse(raw);

    process.env.SUPABASE_CLIENT_QUIET = '1';
    const { supabase, isSupabaseConfigured } = await import('../../server/supabaseClient.js');
    if (!isSupabaseConfigured) throw new Error('Supabase service client is not configured');
    const claimedEvent = await requireHermesImageLease(outboxId, agentIdentity, supabase);
    const analysis = await recordHermesImageAnalysis({ outboxId, agentIdentity, result }, supabase);
    await markAnalysisProvenance({ analysisId: analysis.id, source: 'hermes_image' }, supabase);
    const workflow = await markImageWorkflowAnalyzed({
        outboxEventId: outboxId,
        agentIdentity,
        analysisId: analysis.id
    }, supabase);
    const completedEvent = await completeHermesImageReview(
        claimedEvent,
        agentIdentity,
        analysis.id,
        supabase
    );
    process.stdout.write(`${JSON.stringify({
        ok: true,
        analysis_id: analysis.id,
        outbox_id: outboxId,
        outbox_status: completedEvent.status,
        workflow_stage: workflow.stage,
        workflow_status: workflow.status
    })}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main().catch((error) => {
        process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
        process.exitCode = 1;
    });
}
