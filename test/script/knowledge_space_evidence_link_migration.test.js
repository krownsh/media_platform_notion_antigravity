import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../../database/deployments/stage_w5_knowledge_space_evidence_links.sql', import.meta.url);

test('evidence-link migration keeps workflow evidence additive, owner-isolated, and semantically annotated', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /create table if not exists public\.knowledge_space_stage_evidence_links/i);
  assert.match(sql, /stage_id uuid not null references public\.knowledge_space_path_stages\(id\) on delete cascade/i);
  assert.match(sql, /node_id uuid not null references public\.knowledge_map_nodes\(id\) on delete cascade/i);
  assert.match(sql, /user_id uuid not null references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /evidence_role text not null check \(evidence_role in \('evidence', 'method', 'example', 'decision', 'risk', 'open_question'\)\)/i);
  assert.match(sql, /rationale text not null check \(btrim\(rationale\) <> ''\)/i);
  assert.match(sql, /applicability text not null default ''/i);
  assert.match(sql, /limitation text not null default ''/i);
  assert.match(sql, /status text not null default 'proposed' check \(status in \('proposed', 'accepted', 'superseded', 'archived'\)\)/i);
  assert.match(sql, /unique \(stage_id, node_id, evidence_role, rationale\)/i);

  assert.match(sql, /create (or replace )?function public\.enforce_knowledge_space_stage_evidence_link_owner\(\)/i);
  assert.match(sql, /knowledge-space evidence link must belong to the same owner and space/i);
  assert.match(sql, /alter table public\.knowledge_space_stage_evidence_links enable row level security/i);
  assert.match(sql, /on public\.knowledge_space_stage_evidence_links[\s\S]{0,900}for select to authenticated/i);
  assert.match(sql, /revoke execute on function public\.enforce_knowledge_space_stage_evidence_link_owner\(\) from public, anon, authenticated/i);

  const executableSql = sql.replace(/^--.*$/gm, '');
  assert.doesNotMatch(executableSql, /\b(drop\s+table|truncate|delete\s+from)\b/i);
  assert.doesNotMatch(executableSql, /\b(collection_posts|collection_collections|knowledge_space_stage_nodes)\b[\s\S]*\b(update|insert|delete|alter)\b/i);
  assert.doesNotMatch(executableSql, /grant\s+.*\bto\s+anon/i);
});
