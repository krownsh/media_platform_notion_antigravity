import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const taxonomyPath = new URL('../../docs/knowledge-taxonomy/source-taxonomy-v1.json', import.meta.url);
const governancePath = new URL('../../docs/knowledge-taxonomy/source-taxonomy-v2.json', import.meta.url);
const forbiddenPrimaryNames = new Set(['codex', 'prompt', '好skill', '好用套件', '其他']);

test('source taxonomy v1 defines exactly twenty uniquely keyed, outcome-based categories', async () => {
  const source = await readFile(taxonomyPath, 'utf8');
  const taxonomy = JSON.parse(source);

  assert.equal(createHash('sha256').update(source).digest('hex'), 'faed35ab09c99cca42344fb1b9b8f99088f78496085f7e8ee7d21e393c21ad0c');
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

test('taxonomy v2 governs expansion without mutating the immutable v1 category set or enabling live routing', async () => {
  const [v1, v2] = await Promise.all([
    readFile(taxonomyPath, 'utf8').then(JSON.parse),
    readFile(governancePath, 'utf8').then(JSON.parse)
  ]);

  assert.equal(v2.version, 2);
  assert.equal(v2.artifact_type, 'taxonomy_governance');
  assert.equal(v2.status, 'governance_only_not_live_routing');
  assert.equal(v2.supersedes.version, 1);
  assert.equal(v2.canonical_primary_category_set.source, 'docs/knowledge-taxonomy/source-taxonomy-v1.json');
  assert.equal(v2.canonical_primary_category_set.category_count, v1.categories.length);
  assert.equal(v2.canonical_primary_category_set.uncertain_destination, 'inbox');
  assert.equal(v2.new_category_governance.policy, 'governed_expansion_allowed');
  assert.equal(v2.legacy_collection_policy.status, 'legacy_not_a_primary_routing_allowlist');
  assert.equal(v2.knowledge_map_policy.folder_equivalence, 'forbidden');
  assert.equal(v2.knowledge_map_policy.automatic_post_to_map, false);
  assert.match(v2.phase_gate.phase_0, /No DB, live collection, post, Vault, PM2, Cron, node, or relation mutation/);
  assert.match(v2.phase_gate.before_phase_4, /no automatic source-folder selection/);
});
