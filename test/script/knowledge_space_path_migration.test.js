import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../../database/deployments/stage_w4_knowledge_space_path.sql', import.meta.url);

test('knowledge-space path migration is additive, owner-isolated, and supports extensible stage graphs', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  for (const table of [
    'knowledge_space_path_stages',
    'knowledge_space_stage_nodes',
    'knowledge_space_stage_transitions'
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`on public\\.${table}[\\s\\S]{0,900}for select to authenticated`, 'i'));
  }

  assert.match(sql, /knowledge_space_path_stages[\s\S]*space_id uuid not null/i);
  assert.match(sql, /knowledge_space_path_stages[\s\S]*slug text not null/i);
  assert.match(sql, /knowledge_space_path_stages[\s\S]*unique \(space_id, slug\)/i);
  assert.match(sql, /knowledge_space_path_stages[\s\S]*required_inputs jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /knowledge_space_path_stages[\s\S]*expected_outputs jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /knowledge_space_path_stages[\s\S]*gates jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /coverage_status text not null default 'gap' check \(coverage_status in \('supported', 'partial', 'gap'\)\)/i);

  assert.match(sql, /knowledge_space_stage_nodes[\s\S]*stage_id uuid not null/i);
  assert.match(sql, /knowledge_space_stage_nodes[\s\S]*node_id uuid not null/i);
  assert.match(sql, /unique \(stage_id, node_id\)/i);

  assert.match(sql, /knowledge_space_stage_transitions[\s\S]*from_stage_id uuid not null/i);
  assert.match(sql, /knowledge_space_stage_transitions[\s\S]*to_stage_id uuid not null/i);
  assert.match(sql, /transition_type text not null check \(transition_type in \('progression', 'branch', 'feedback'\)\)/i);
  assert.match(sql, /unique \(from_stage_id, to_stage_id, transition_type\)/i);

  const executableSql = sql.replace(/^--.*$/gm, '');
  assert.doesNotMatch(executableSql, /\b(drop\s+table|truncate|delete\s+from)\b/i);
  assert.doesNotMatch(executableSql, /\b(collection_posts|collection_collections)\b[\s\S]*\b(update|insert|delete|alter)\b/i);
  assert.doesNotMatch(executableSql, /grant\s+.*\bto\s+anon/i);
});
