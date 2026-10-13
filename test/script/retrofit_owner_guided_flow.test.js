import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRetrofitArguments, retrofitOwnerGuidedFlow } from '../../scripts/maintenance/retrofit-owner-guided-flow.js';

test('retrofit requires a named owner and bounded scope', () => {
    assert.throws(() => parseRetrofitArguments([]), /user-id/);
    assert.throws(() => parseRetrofitArguments(['--user-id', 'owner', '--page-size', '101']), /at most 100/);
    assert.deepEqual(parseRetrofitArguments(['--user-id', 'owner', '--limit', '20']), { apply: false, userId: 'owner', pageSize: 25, limit: 20, offset: 0, concurrency: 3 });
});

test('retrofit rebuilds current search and creates repair-visible jobs without semantic promotion', async () => {
    const calls = { search: [], packet: [], job: [] };
    const pages = [[{ id: 'post-1' }, { id: 'post-2' }], []];
    const chain = value => ({ select: () => chain(value), eq: () => chain(value), order: () => chain(value), range: () => chain(value), limit: () => chain(value), then: resolve => Promise.resolve({ data: value, error: null }).then(resolve) });
    const client = { from(table) { if (table === 'collection_posts') return chain(pages.shift() || []); if (table === 'collection_source_revisions') return chain([{ id: 'source-1', capture_quality: calls.search.length ? 'partial' : 'complete' }]); throw new Error(`unexpected table ${table}`); } };
    const stats = await retrofitOwnerGuidedFlow({ apply: true, userId: 'owner', pageSize: 2, concurrency: 1, supabaseClient: client,
        refreshSearch: async input => calls.search.push(input),
        ensurePacket: async input => { calls.packet.push(input); return { id: `packet-${calls.packet.length}` }; },
        ensureJob: async input => calls.job.push(input)
    });
    assert.deepEqual([stats.discovered, stats.complete, stats.partial, stats.searchRebuilt, stats.jobsEnsured], [2, 1, 1, 2, 2]);
    assert.equal(calls.job[0].captureQuality, 'complete');
    assert.equal(calls.job[1].captureQuality, 'partial');
});

test('retrofit records one failed post but continues to later pages', async () => {
    const pages = [[{ id: 'post-1' }], [{ id: 'post-2' }], []];
    const chain = value => ({ select: () => chain(value), eq: () => chain(value), order: () => chain(value), range: () => chain(value), limit: () => chain(value), then: resolve => Promise.resolve({ data: value, error: null }).then(resolve) });
    const client = { from(table) { if (table === 'collection_posts') return chain(pages.shift() || []); if (table === 'collection_source_revisions') return chain([{ id: 'source', capture_quality: 'partial' }]); throw new Error(`unexpected table ${table}`); } };
    const stats = await retrofitOwnerGuidedFlow({ apply: true, userId: 'owner', pageSize: 1, supabaseClient: client,
        refreshSearch: async ({ postId }) => { if (postId === 'post-1') throw new Error('temporary failure'); },
        ensurePacket: async () => ({ id: 'packet' }), ensureJob: async () => {}
    });
    assert.deepEqual([stats.discovered, stats.failures.length, stats.jobsEnsured], [2, 1, 1]);
});
