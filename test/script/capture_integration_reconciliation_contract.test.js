import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('capture integration matrix preserves the owner-guided source boundary during the dirty-checkout merge', async () => {
    const matrix = await readFile(new URL('../../docs/plans/2026-10-06-capture-service-reconciliation-matrix.md', import.meta.url), 'utf8');

    for (const requirement of [
        'captureQuality: \'partial\'',
        'capture_quality in (\'complete\', \'partial\')',
        'source_revision_id',
        'p_analysis: {}',
        'refreshOwnerPostSearchDocument',
        'prepareInitialReviewProposals',
        'outboxEventId: null',
        'Core-platform failures remain retryable',
        'do not overwrite extracted source data with fallback',
        'not authorized'
    ]) {
        assert.ok(matrix.includes(requirement), `matrix must include: ${requirement}`);
    }
});
