import test from 'node:test';
import assert from 'node:assert/strict';
import {
    decidePocProposal,
    importLegacyTopicToOwner,
    importLegacyProjectToCatalog,
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

test('legacy projects become Catalog records only after an explicit import', async () => {
    const inserts = [];
    const client = {
        from(table) {
            if (table === 'collection_projects') return {
                select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: {
                    id: 'legacy-1', title: 'UIUX', slug: 'uiux', repository_target: 'github:owner/uiux', description: null, status: 'active'
                }, error: null })
            };
            assert.equal(table, 'owner_project_catalog');
            return {
                insert(value) { inserts.push(value); return this; }, select() { return this; }, single: async () => ({ data: { id: 'catalog-1', ...inserts[0] }, error: null })
            };
        }
    };
    const imported = await importLegacyProjectToCatalog({ userId: 'user-1', legacyProjectId: 'legacy-1', supabaseClient: client });
    assert.equal(imported.id, 'catalog-1');
    assert.deepEqual(inserts[0], {
        user_id: 'user-1', title: 'UIUX', slug: 'uiux', project_kind: 'remote_repository', reference: 'github:owner/uiux',
        description: 'Imported after explicit Owner approval from the previous project list.'
    });
});

test('a user-authored active legacy Topic becomes a new Topic only after an explicit import', async () => {
    const inserts = [];
    const client = {
        from(table) {
            if (table === 'collection_topics') return {
                select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: {
                    id: 'legacy-topic-1', title: 'UI UX', origin: 'user', status: 'active'
                }, error: null })
            };
            assert.equal(table, 'owner_topics');
            return {
                insert(value) { inserts.push(value); return this; }, select() { return this; }, single: async () => ({ data: { id: 'topic-1', ...inserts[0] }, error: null })
            };
        }
    };
    const imported = await importLegacyTopicToOwner({ userId: 'user-1', legacyTopicId: 'legacy-topic-1', supabaseClient: client });
    assert.equal(imported.id, 'topic-1');
    assert.deepEqual(inserts[0], { user_id: 'user-1', label: 'UI UX', normalized_label: 'ui ux' });
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
