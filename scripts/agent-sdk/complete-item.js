import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

import { supabase } from '../../server/supabaseClient.js';

async function completeItem(outboxId, notes) {
    if (!outboxId) {
        console.error('❌ Please provide an Outbox ID. Usage: node complete-item.js <outbox_id> ["optional notes"]');
        process.exit(1);
    }

    console.log(`[Agent SDK] Marking outbox item ${outboxId} as completed...`);

    const { data, error } = await supabase
        .from('collection_capture_outbox')
        .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            error_message: notes || 'Processed interactively by Agent'
        })
        .eq('id', outboxId)
        .select()
        .single();

    if (error) {
        console.error('❌ Failed to update outbox event:', error.message);
        process.exit(1);
    }

    console.log(`✅ Successfully marked outbox item ${outboxId} as processed.`);
}

const outboxId = process.argv[2];
const notes = process.argv[3] || '';
completeItem(outboxId, notes);
