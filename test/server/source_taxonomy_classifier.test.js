import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANONICAL_SOURCE_TAXONOMY_KEYS,
  canonicalTaxonomyArtifactSha256,
  classifyCanonicalProposal,
  validateCanonicalClassification
} from '../../server/services/sourceTaxonomyClassifier.js';

const source = {
  id: 'post-1',
  title: 'MCP agent workflow guide',
  content: 'This guide covers MCP tool calling and multi-agent workflow orchestration.'
};

test('canonical classifier loads v1 as the sole key allowlist and fingerprints the artifact', () => {
  assert.equal(CANONICAL_SOURCE_TAXONOMY_KEYS.size, 20);
  assert.equal(CANONICAL_SOURCE_TAXONOMY_KEYS.has('agent-systems-mcp-automation'), true);
  assert.match(canonicalTaxonomyArtifactSha256(), /^[a-f0-9]{64}$/);
});

test('canonical classification accepts only a cited v1 key with a bounded confidence', () => {
  const result = validateCanonicalClassification({
    source,
    classification: {
      category_key: 'agent-systems-mcp-automation',
      confidence: 0.95,
      evidence_excerpt: 'MCP tool calling and multi-agent workflow',
      rationale: 'The source primarily teaches agent orchestration.'
    }
  });

  assert.equal(result.status, 'accepted');
  assert.equal(result.category_key, 'agent-systems-mcp-automation');
  assert.equal(result.classifier_kind, 'hermes_codex');
});

test('invalid model output, missing source evidence, or low confidence becomes needs_review rather than legacy other', () => {
  for (const classification of [
    { category_key: 'tool', confidence: 0.95, evidence_excerpt: 'MCP tool calling' },
    { category_key: 'agent-systems-mcp-automation', confidence: 1.1, evidence_excerpt: 'MCP tool calling' },
    { category_key: 'agent-systems-mcp-automation', confidence: 0.95, evidence_excerpt: 'not in the source' },
    { category_key: 'agent-systems-mcp-automation', confidence: 0.78, evidence_excerpt: 'MCP tool calling' }
  ]) {
    const result = validateCanonicalClassification({ source, classification });
    assert.equal(result.status, 'needs_review');
    assert.notEqual(result.category_key, 'other');
  }
});

test('proposal normalizer records a content hash and never proposes a collection target', () => {
  const proposal = classifyCanonicalProposal({
    source,
    classification: {
      category_key: 'agent-systems-mcp-automation',
      confidence: 0.95,
      evidence_excerpt: 'MCP tool calling',
      rationale: 'Agent runtime.'
    }
  });

  assert.equal(proposal.post_id, source.id);
  assert.match(proposal.source_content_hash, /^[a-f0-9]{64}$/);
  assert.equal('collection_id' in proposal, false);
  assert.equal(proposal.taxonomy_version, 1);
});
