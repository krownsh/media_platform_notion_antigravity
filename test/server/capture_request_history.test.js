import assert from 'node:assert/strict';
import test from 'node:test';

import { listCaptureRequests } from '../../server/services/captureRequestService.js';

test('capture history is tenant-scoped, newest first, and bounded', async () => {
    const calls = [];
    const supabaseClient = {
        from(table) {
            calls.push({ method: 'from', table });
            return {
                select(selection) {
                    calls.push({ method: 'select', selection });
                    return this;
                },
                eq(column, value) {
                    calls.push({ method: 'eq', column, value });
                    return this;
                },
                order(column, options) {
                    calls.push({ method: 'order', column, options });
                    return this;
                },
                limit(value) {
                    calls.push({ method: 'limit', value });
                    return Promise.resolve({ data: [{ id: 'capture-1', status: 'failed' }], error: null });
                }
            };
        }
    };

    const result = await listCaptureRequests('user-1', { limit: 999 }, supabaseClient);
    assert.deepEqual(result, [{ id: 'capture-1', status: 'failed' }]);
    assert.deepEqual(calls.find(call => call.method === 'eq'), { method: 'eq', column: 'user_id', value: 'user-1' });
    assert.deepEqual(calls.find(call => call.method === 'order'), { method: 'order', column: 'created_at', options: { ascending: false } });
    assert.deepEqual(calls.find(call => call.method === 'limit'), { method: 'limit', value: 100 });
});
