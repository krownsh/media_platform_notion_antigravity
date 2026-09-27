import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSourceTaxonomyManifest, FIXED_DRY_RUN_POST_LIMIT, fetchFixedOwnerPosts, parsePredictionRows } from '../../scripts/maintenance/propose-source-taxonomy-backfill.js';

const ownerId = '50984520-69ad-4e64-b9c1-503f5c1b0e63';
const posts = [
  { id: 'a', user_id: ownerId, title: 'MCP tutorial', content: 'MCP tool calling workflow' },
  { id: 'b', user_id: ownerId, title: 'Unknown', content: 'brief note' }
];

const classifications = new Map([
  ['a', {
    category_key: 'agent-systems-mcp-automation', confidence: 0.95,
    evidence_excerpt: 'MCP tool calling', rationale: 'Agent workflow.'
  }],
  ['b', {
    category_key: 'knowledge-learning-productivity', confidence: 0.4,
    evidence_excerpt: 'brief note', rationale: 'Insufficient context.'
  }]
]);

test('fixed dry-run selector reads exactly the first 25 owner posts in stable id order', async () => {
  const calls = [];
  const expectedPosts = [{ id: 'post-1', user_id: ownerId }];
  const client = {
    from(table) {
      calls.push(['from', table]);
      return {
        select(columns) {
          calls.push(['select', columns]);
          return {
            eq(column, value) {
              calls.push(['eq', column, value]);
              return {
                order(column, options) {
                  calls.push(['order', column, options]);
                  return {
                    limit(value) {
                      calls.push(['limit', value]);
                      return Promise.resolve({ data: expectedPosts, error: null });
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };

  assert.equal(FIXED_DRY_RUN_POST_LIMIT, 25);
  assert.deepEqual(await fetchFixedOwnerPosts(ownerId, client), expectedPosts);
  assert.deepEqual(calls.at(-1), ['limit', 25]);
  assert.deepEqual(calls.find(call => call[0] === 'order'), ['order', 'id', { ascending: true }]);
});

test('backfill manifest covers each unique owner post without collection or legacy-category fields', () => {
  const result = buildSourceTaxonomyManifest({ posts, classifications, userId: ownerId });
  assert.equal(result.summary.total_posts, 2);
  assert.equal(result.summary.accepted, 1);
  assert.equal(result.summary.needs_review, 1);
  assert.deepEqual(result.proposals.map(item => item.post_id), ['a', 'b']);
  for (const proposal of result.proposals) {
    assert.equal('collection_id' in proposal, false);
    assert.equal('primary_category' in proposal, false);
    assert.equal('legacy_category' in proposal, false);
  }
});

test('prediction parser refuses duplicate or malformed prediction rows', () => {
  assert.throws(() => parsePredictionRows([{ post_id: 'a' }, { post_id: 'a' }]), /Duplicate prediction/);
  assert.throws(() => parsePredictionRows([{ category_key: 'agent-systems-mcp-automation' }]), /post_id/);
});

test('backfill manifest refuses malformed owner ids, foreign or duplicate source ids, and unknown predictions', () => {
  const singlePrediction = new Map([['a', classifications.get('a')]]);
  assert.throws(() => buildSourceTaxonomyManifest({ posts, classifications, userId: 'owner-1' }), /valid UUID/);
  assert.throws(() => buildSourceTaxonomyManifest({ posts: [{ ...posts[0], user_id: '50984520-69ad-4e64-b9c1-503f5c1b0e64' }], classifications: singlePrediction, userId: ownerId }), /does not belong/);
  assert.throws(() => buildSourceTaxonomyManifest({ posts: [posts[0], posts[0]], classifications: singlePrediction, userId: ownerId }), /duplicate/);
  assert.throws(() => buildSourceTaxonomyManifest({ posts, classifications: new Map([...classifications, ['unknown', classifications.get('a')]]), userId: ownerId }), /unknown post/);
});
