import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

import { supabase } from '../../server/supabaseClient.js';
import { persistOutboxRouteTransition } from '../../server/services/outboxRouteStateService.js';

export async function completeItem(outboxId, routeType, notes) {
    if (!outboxId || !routeType) {
        throw new Error('Usage: node complete-item.js <outbox_id> <route_type> ["optional notes"]');
    }

    console.log(`[Agent SDK] Marking route ${routeType} for outbox ${outboxId} as completed...`);

    const { data: currentEvent, error: readError } = await supabase
        .from('collection_capture_outbox')
        .select('id, user_id, status, payload, updated_at, locked_at, locked_by, last_error')
        .eq('id', outboxId)
        .single();

    if (readError || !currentEvent) {
        throw new Error(`Failed to read outbox event: ${readError?.message || 'Item not found'}`);
    }

    const data = await persistOutboxRouteTransition(
        currentEvent,
        routeType,
        'completed',
        { completed_at: new Date().toISOString(), notes: notes || 'Processed interactively by Agent' },
        supabase
    );

    console.log(`[Agent SDK] Route ${routeType} completed; outbox status is ${data.status}.`);
    return data;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
    const outboxId = process.argv[2];
    const routeType = process.argv[3];
    const notes = process.argv[4] || '';
    completeItem(outboxId, routeType, notes).catch(error => {
        console.error('❌ [Agent SDK] Complete failed:', error.message);
        process.exitCode = 1;
    });
}
