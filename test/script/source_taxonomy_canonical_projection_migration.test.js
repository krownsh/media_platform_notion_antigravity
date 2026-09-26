import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const current = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(current), '..', '..');
const sql = fs.readFileSync(path.join(root, 'database/deployments/stage_y_source_post_canonical_classifications.sql'), 'utf8');
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'docs/knowledge-taxonomy/source-taxonomy-v1.json'), 'utf8'));

test('canonical classification migration is additive and retains a complete audit boundary', () => {
  assert.match(sql, /create table if not exists public\.source_post_canonical_classifications/i);
  assert.match(sql, /create table if not exists public\.source_post_canonical_classification_audit_events/i);
  assert.match(sql, /taxonomy_artifact_sha256 text not null check \(taxonomy_artifact_sha256 ~ '\^\[a-f0-9\]\{64\}\$'\)/i);
  assert.match(sql, /status text not null check \(status in \('proposed', 'accepted', 'needs_review', 'rejected'\)\)/i);
  assert.match(sql, /unique \(post_id, taxonomy_artifact_sha256\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /after insert or update on public\.source_post_canonical_classifications/i);
  assert.match(sql, /before_snapshot := to_jsonb\(old\)/i);
  assert.match(sql, /'before', before_snapshot/i);
  assert.match(sql, /'after', to_jsonb\(new\)/i);
  assert.match(sql, /actor := auth\.uid\(\)/i);
  assert.match(sql, /before update or delete/i);
  const auditTable = sql.match(/create table if not exists public\.source_post_canonical_classification_audit_events \(([\s\S]*?)\n\);/i)?.[1] || '';
  assert.doesNotMatch(auditTable, /on delete cascade/i);
  assert.doesNotMatch(sql, /\b(drop table|truncate|alter table public\.collection_posts|collection_id|primary_category)\b/i);
});

test('canonical classification database allowlist exactly matches source taxonomy v1', () => {
  for (const category of taxonomy.categories) assert.match(sql, new RegExp(`'${category.key}'`));
  const quotedKeys = [...sql.matchAll(/'([a-z]+(?:-[a-z]+)+)'/g)].map(match => match[1]);
  const sqlCategoryKeys = quotedKeys.filter(key => taxonomy.categories.some(category => category.key === key));
  assert.equal(new Set(sqlCategoryKeys).size, taxonomy.categories.length);
  assert.doesNotMatch(sql, /'other'/i);
});
