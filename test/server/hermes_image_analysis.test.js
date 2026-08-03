import assert from 'node:assert/strict';
import test from 'node:test';
import {
    normalizeImageAnalysisResult,
    recordHermesImageAnalysis
} from '../../server/services/hermesImageAnalysisService.js';

const OUTBOX_ID = '11111111-1111-4111-8111-111111111111';

test('Hermes image analysis is normalized before the scoped RPC write-back', async () => {
    let rpcCall;
    const supabase = {
        rpc: (name, params) => ({
            single: async () => {
                rpcCall = { name, params };
                return { data: { id: 'analysis-1' }, error: null };
            }
        })
    };

    const stored = await recordHermesImageAnalysis({
        outboxId: OUTBOX_ID,
        agentIdentity: 'hermes:cron:media-inbox',
        result: {
            summary: '  收據顯示午餐費用  ',
            description: '桌面上的紙本收據',
            ocr_text: 'Total 250',
            tags: [' 收據 ', '', 3],
            topics: ['expense']
        }
    }, supabase);

    assert.equal(stored.id, 'analysis-1');
    assert.equal(rpcCall.name, 'record_collection_image_analysis');
    assert.equal(rpcCall.params.p_outbox_id, OUTBOX_ID);
    assert.equal(rpcCall.params.p_result.summary, '收據顯示午餐費用');
    assert.deepEqual(rpcCall.params.p_result.tags, ['收據']);
});

test('Hermes image analysis requires a meaningful summary', () => {
    assert.throws(() => normalizeImageAnalysisResult({ description: 'only description' }), /summary is required/);
});
