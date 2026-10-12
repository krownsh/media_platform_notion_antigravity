import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildHistoricalSourceRevision,
    parseBackfillArguments
} from '../../scripts/maintenance/backfill-owner-guided-inbox.js';

test('historical backfill converts database source facts into a partial immutable revision without legacy semantics', () => {
    const revision = buildHistoricalSourceRevision({
        id: 'post-12345678-0000-4000-8000-000000000000',
        user_id: 'user-1', platform: 'threads', original_url: 'https://threads.net/@owner/post/1',
        title: null, author_name: 'Owner', author_id: 'owner-1',
        content: '原始貼文全文', posted_at: '2026-10-01T00:00:00.000Z',
        created_at: '2026-10-01T00:10:00.000Z', full_json: { ignored: 'legacy analysis must not be imported' }
    }, [{ type: 'image', url: 'https://example.test/image.jpg', order: 0 }], [{ author_name: 'Reader', content: '留言', commented_at: '2026-10-01T01:00:00.000Z' }]);

    assert.equal(revision.correlation_id, 'historical-inbox-post-12345678-0000-4000-8000-000000000000');
    assert.equal(revision.pipeline_version, 'owner-guided-inbox-backfill-v1');
    assert.equal(revision.capture_quality, 'partial');
    assert.equal(revision.source_payload.source, 'historical_collection_import');
    assert.equal(revision.source_payload.post.content, '原始貼文全文');
    assert.equal(revision.source_payload.media[0].type, 'image');
    assert.equal(revision.source_payload.media[0].url, 'https://example.test/image.jpg');
    assert.equal(revision.source_payload.media[0].order, 0);
    assert.deepEqual(revision.source_payload.comments, [{ author_name: 'Reader', content: '留言', commented_at: '2026-10-01T01:00:00.000Z' }]);
    assert.equal(Object.hasOwn(revision.source_payload.post, 'full_json'), false);
    assert.equal(Object.hasOwn(revision.source_payload, 'analysis'), false);
});

test('backfill is dry-run by default and refuses an unscoped apply', () => {
    assert.deepEqual(parseBackfillArguments([]), { apply: false, userId: null, pageSize: 25, limit: null, offset: 0, concurrency: 4, forceInbox: false });
    assert.throws(() => parseBackfillArguments(['--apply']), /--user-id is required/);
    assert.deepEqual(
        parseBackfillArguments(['--apply', '--user-id', 'user-1', '--page-size', '10', '--limit', '3', '--offset', '50', '--concurrency', '2', '--force-inbox']),
        { apply: true, userId: 'user-1', pageSize: 10, limit: 3, offset: 50, concurrency: 2, forceInbox: true }
    );
});
