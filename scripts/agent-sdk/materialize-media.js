import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { materializeHermesMedia } from '../../server/services/hermesMediaAccessService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env'), quiet: true });

async function main() {
    const outboxId = process.argv[2];
    process.env.SUPABASE_CLIENT_QUIET = '1';
    const { supabase, isSupabaseConfigured } = await import('../../server/supabaseClient.js');
    if (!isSupabaseConfigured) throw new Error('Supabase service client is not configured');

    const result = await materializeHermesMedia(outboxId, supabase);
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    main().catch((error) => {
        process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || 'ERROR', error: error.message })}\n`);
        process.exitCode = 1;
    });
}
