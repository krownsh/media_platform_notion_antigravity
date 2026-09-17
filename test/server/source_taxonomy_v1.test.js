import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const taxonomyPath = new URL('../../docs/knowledge-taxonomy/source-taxonomy-v1.json', import.meta.url);
const forbiddenPrimaryNames = new Set(['codex', 'prompt', '好skill', '好用套件', '其他']);

test('source taxonomy v1 defines exactly twenty uniquely keyed, outcome-based categories', async () => {
  const taxonomy = JSON.parse(await readFile(taxonomyPath, 'utf8'));

  assert.equal(taxonomy.version, 1);
  assert.equal(taxonomy.categories.length, 20);

  const keys = taxonomy.categories.map(category => category.key);
  assert.equal(new Set(keys).size, 20);

  for (const category of taxonomy.categories) {
    assert.equal(typeof category.key, 'string');
    assert.match(category.key, /^[a-z0-9-]+$/);
    assert.equal(typeof category.proposed_name, 'string');
    assert.ok(category.proposed_name.trim());
    assert.equal(forbiddenPrimaryNames.has(category.proposed_name.toLowerCase()), false);
    assert.equal(typeof category.include, 'string');
    assert.ok(category.include.trim());
    assert.equal(typeof category.exclude, 'string');
    assert.ok(category.exclude.trim());
    assert.ok(Array.isArray(category.knowledge_space_affinities));
  }
});

test('source taxonomy v1 records that category names are proposed metadata, not live folder mutations', async () => {
  const taxonomy = JSON.parse(await readFile(taxonomyPath, 'utf8'));

  assert.equal(taxonomy.mutation_policy.rename_live_collections, 'owner_approval_required');
  assert.equal(taxonomy.mutation_policy.reassign_existing_posts, 'owner_approved_manifest_required');
  assert.equal(taxonomy.mutation_policy.low_confidence_destination, 'inbox');
  assert.equal(taxonomy.primary_assignment_policy, 'one_source_folder_per_post');
});
