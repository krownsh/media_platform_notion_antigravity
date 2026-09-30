-- Applied to Supabase as migration: add_topic_match_repair_backups (20260930035040)
-- Immutable audit backup for owner-authorized repair of historical topic-source matches.
create table if not exists public.collection_topic_match_repair_backups (
  id uuid primary key default gen_random_uuid(),
  repair_batch text not null,
  match_id uuid not null,
  original_row jsonb not null,
  repair_reason text not null,
  backed_up_at timestamptz not null default now(),
  unique (repair_batch, match_id)
);

alter table public.collection_topic_match_repair_backups enable row level security;

create policy "Users may read their own topic match repair backups"
on public.collection_topic_match_repair_backups
for select
to authenticated
using ((original_row ->> 'user_id') = auth.uid()::text);
