import test from 'node:test';
import assert from 'node:assert/strict';
import {
    decidePocProposal,
    normalizeOwnerTopicLabel,
    normalizeProjectCatalogInput
} from '../../server/services/ownerKnowledgeService.js';

test('independent Topic and flexible Project Catalog inputs have explicit owner-safe shapes', () => {
    assert.deepEqual(normalizeOwnerTopicLabel(' UI UX '), { label: 'UI UX', normalizedLabel: 'ui ux' });
    assert.deepEqual(normalizeProjectCatalogInput({
        title: 'Research initiative', slug: 'research-initiative', project_kind: 'non_code', reference: 'initiative:research', description: 'No repository required'
    }), {
        title: 'Research initiative', slug: 'research-initiative', project_kind: 'non_code', reference: 'initiative:research', description: 'No repository required'
    });
    assert.throws(() => normalizeProjectCatalogInput({ title: 'x', slug: 'x', project_kind: 'github_only', reference: 'x' }), /project_kind/);
});

test('POC approval uses an explicit second action with an optimistic version lock', async () => {
    let update;
    const client = {
        from(table) {
            assert.equal(table, 'owner_poc_proposals');
            return {
                update(value) { update = value; return this; },
                eq() { return this; },
                select() { return this; },
                maybeSingle: async () => ({ data: { id: 'poc-1', status: 'approved', version: 2 }, error: null })
            };
        }
    };
    const result = await decidePocProposal({ userId: 'user-1', proposalId: 'poc-1', action: 'approve', expectedVersion: 1, supabaseClient: client });
    assert.equal(result.status, 'approved');
    assert.equal(update.status, 'approved');
    assert.equal(update.version, 2);
    assert.equal(typeof update.approved_at, 'string');
});
