import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../../database/deployments/stage_w_knowledge_spaces.sql', import.meta.url);

test('knowledge spaces migration is additive, owner-isolated, and evidence-first', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /create table if not exists public\.knowledge_spaces/i);
  assert.match(sql, /create table if not exists public\.knowledge_map_nodes/i);
  assert.match(sql, /create table if not exists public\.knowledge_node_evidence/i);

  for (const table of ['knowledge_spaces', 'knowledge_map_nodes', 'knowledge_node_evidence']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`on public\\.${table}[\\s\\S]{0,900}for select to authenticated`, 'i'));
  }

  assert.match(sql, /knowledge_spaces[\s\S]*user_id uuid not null references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /knowledge_map_nodes[\s\S]*space_id uuid not null references public\.knowledge_spaces\(id\) on delete cascade/i);
  assert.match(sql, /knowledge_node_evidence[\s\S]*source_post_id uuid not null references public\.collection_posts\(id\) on delete restrict/i);
  assert.match(sql, /node_type text not null check \(node_type in \('technology', 'workflow', 'option', 'comparison', 'decision', 'question'\)\)/i);
  assert.match(sql, /evidence_role text not null check \(evidence_role in \('supports', 'contrasts', 'workflow_step', 'limitation', 'implementation', 'decision_input'\)\)/i);
  assert.match(sql, /unique \(space_id, slug\)/i);
  assert.match(sql, /unique \(node_id, source_post_id, evidence_role, excerpt_hash\)/i);

  assert.doesNotMatch(sql, /\b(drop\s+table|truncate)\b/i);
  assert.doesNotMatch(sql, /grant\s+.*\bto\s+anon/i);
});
