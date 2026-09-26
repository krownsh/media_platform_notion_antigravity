import crypto from 'node:crypto';
import fs from 'node:fs';

const taxonomyPath = new URL('../../docs/knowledge-taxonomy/source-taxonomy-v1.json', import.meta.url);
const taxonomyRaw = fs.readFileSync(taxonomyPath, 'utf8');
const taxonomy = JSON.parse(taxonomyRaw);

export const CANONICAL_SOURCE_TAXONOMY_KEYS = new Set(taxonomy.categories.map(category => category.key));
export const CANONICAL_SOURCE_TAXONOMY_VERSION = taxonomy.version;
export const DEFAULT_ACCEPTANCE_CONFIDENCE = 0.85;

export function canonicalTaxonomyArtifactSha256() {
  return crypto.createHash('sha256').update(taxonomyRaw, 'utf8').digest('hex');
}

export function sourceClassificationText(source = {}) {
  const full = source.full_json && typeof source.full_json === 'object' ? source.full_json : {};
  return [
    source.title,
    source.content,
    full.content,
    full.text,
    full.raw_content,
    full.main_text
  ]
    .filter(value => typeof value === 'string' && value.trim())
    .join('\n')
    .normalize('NFKC');
}

export function sourceContentSha256(source = {}) {
  return crypto.createHash('sha256').update(sourceClassificationText(source), 'utf8').digest('hex');
}

export function isCanonicalSourceTaxonomyKey(value) {
  return CANONICAL_SOURCE_TAXONOMY_KEYS.has(String(value || '').trim());
}

function normalizedExcerpt(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function validateCanonicalClassification({ source, classification, acceptanceConfidence = DEFAULT_ACCEPTANCE_CONFIDENCE } = {}) {
  const input = classification && typeof classification === 'object' ? classification : {};
  const categoryKey = String(input.category_key || '').trim();
  const confidence = Number(input.confidence);
  const evidenceExcerpt = normalizedExcerpt(input.evidence_excerpt);
  const sourceText = normalizedExcerpt(sourceClassificationText(source));
  const violations = [];

  if (!isCanonicalSourceTaxonomyKey(categoryKey)) violations.push('category_key_not_in_v1_allowlist');
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) violations.push('confidence_out_of_range');
  if (!evidenceExcerpt) violations.push('evidence_excerpt_required');
  else if (!sourceText.includes(evidenceExcerpt)) violations.push('evidence_excerpt_not_found_in_source');

  const confidenceIsAcceptable = Number.isFinite(confidence) && confidence >= acceptanceConfidence;
  if (violations.length === 0 && !confidenceIsAcceptable) violations.push('confidence_below_acceptance_threshold');

  return {
    category_key: isCanonicalSourceTaxonomyKey(categoryKey) ? categoryKey : null,
    confidence: Number.isFinite(confidence) ? confidence : null,
    evidence_excerpt: evidenceExcerpt || null,
    rationale: String(input.rationale || '').trim() || null,
    status: violations.length === 0 ? 'accepted' : 'needs_review',
    classifier_kind: String(input.classifier_kind || 'hermes_codex').trim() || 'hermes_codex',
    classifier_version: String(input.classifier_version || 'v1').trim() || 'v1',
    violations
  };
}

export function classifyCanonicalProposal({ source, classification, acceptanceConfidence } = {}) {
  if (!source?.id) throw new Error('Source post id is required for a canonical classification proposal');
  const validated = validateCanonicalClassification({ source, classification, acceptanceConfidence });
  return {
    post_id: source.id,
    user_id: source.user_id || null,
    taxonomy_version: CANONICAL_SOURCE_TAXONOMY_VERSION,
    taxonomy_artifact_sha256: canonicalTaxonomyArtifactSha256(),
    source_content_hash: sourceContentSha256(source),
    ...validated
  };
}
