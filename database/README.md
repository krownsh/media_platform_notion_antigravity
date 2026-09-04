# Database files

This directory separates the intended database shape from SQL that is applied to
an already-running environment. It is a source layout only: moving these files
does **not** execute SQL or create Supabase migration history.

## Layout

- `schema/schema.sql` — reference schema for a clean database. Do not run it
  blindly against an existing environment.
- `deployments/add_unique_constraint.sql` — tenant-aware uniqueness deployment
  for `collection_posts(user_id, original_url)`.
- `deployments/stage_b_source_finalization.sql` — Stage B RPC and transactional
  outbox deployment.
- `deployments/stage_d_2_article_title.sql` — additive article-title column and
  a service-role-only replacement of the existing capture finalization RPC.
- `deployments/stage_e_async_capture_requests.sql` — durable non-blocking
  capture intake, atomic worker leases, retries, and status tracking. It does
  not run Hermes or any other AI inside the capture request.
- `deployments/stage_f_private_image_captures.sql` — private image Storage,
  durable image-capture metadata, media storage references, and the
  service-role-only image enqueue/finalization contract. Apply after Stage E.
- `deployments/stage_g_post_workflow.sql` — resumable user workflow, explicit
  action plan, provenance, and the mandatory final `vault_note` action. Apply
  after Stage F.
- `deployments/stage_j_hermes_cron_pull_cleanup.sql` — removes the retired
  Hermes Webhook/Dispatcher tables, trigger, and RPCs; adds the singleton Cron
  Pull lease RPCs. It does not alter the shared capture or post-workflow tables.
- `deployments/stage_j_hermes_cron_include_backlog.sql` — removes the discarded
  24-hour eligibility field and makes the claim RPC FIFO over the complete
  available pending/retryable-failed queue, including historical rows.
- `deployments/stage_j_hermes_cron_lease_index_cleanup.sql` — removes the
  unnecessary index from the one-row Cron lease table.
- `deployments/stage_k_hermes_autonomous_preprocess.sql` — adds exact source
  identity keys, autonomous workflow stages, and separate preprocess/research
  Cron queues without vector storage.
- `deployments/stage_k_hermes_review_backfill.sql` and
  `deployments/stage_k_hermes_review_reconcile.sql` — move legacy strategy
  pauses to persisted `review/awaiting_user` records.
- `deployments/stage_o_topic_project_governance.sql` — adds the active GitHub
  project registry and project × domain topics; blocks future `agent_auto`
  topic creation. It intentionally does not modify existing topic data.
- `deployments/stage_o_stop_auto_container_creation.sql` — preserves the Stage M
  DB-only lifecycle while preventing unattended Collection and Topic creation;
  free-text candidates remain workflow suggestions.
- `deployments/stage_p_collection_rls_hardening.sql` — enables owner-only RLS
  for `collection_posts` and `collection_collections`, removes anonymous
  access, and enforces same-owner post-to-Collection links. It was applied to
  project `dcyjictvatixbflfrsfg` as migration `20260904175657` after a
  no-cross-tenant-link preflight. The production owner-read and grants checks
  passed; no separate paid test branch was created.
- `deployments/stage_q_topic_match_governance_hardening.sql` — makes the
  database fail closed when an agent writes a Topic source match: only active
  user-owned Topics qualify, and the match remains `suggested` until a user
  decision. It was applied to project `dcyjictvatixbflfrsfg` as migration
  `20260904190651`; the transactional smoke test passed without retaining test
  data, and the existing 60 Topic matches were unchanged.
- `deployments/schema_aggregator.sql` — category/domain upgrade. Its current
  `source_domains` definition matches Stage B (`text[]`). Environments that
  previously applied an older JSONB version still require the preflight in the
  Stage B deployment guide before they accept new captures.

Stage H/I deployment files remain as historical source records only. They must
not be re-applied after Stage J; the active Hermes integration is Cron Pull.

## Legacy auto-container dry-run (read-only)

Create the migration manifest only after the live schema has the link-only Stage O
function. The script needs an explicitly named local environment file; it never
loads credentials implicitly from another worktree and performs only `SELECT`
queries before writing artifact files.

```powershell
node scripts/maintenance/audit-auto-containers.js `
  --env-file G:\media_platform_notion_antigravity\server\.env `
  --output artifacts/container-migration/<timestamp>
node scripts/maintenance/plan-auto-container-migration.js `
  --output artifacts/container-migration/<timestamp>
```

The manifest does not modify the database or Vault. Every proposed row has a
zero confidence score and requires explicit Owner confirmation before any
migration can run.

## Deployment rules

1. Back up and use staging first.
2. Execute only the deployment that matches the target's current schema.
3. Record the target, date, operator, and smoke-test result in the task log.
4. Generate formal Supabase migration history from the verified remote schema
   with the team's Supabase CLI workflow; do not treat files in `deployments/`
   as migration history.

The user has reported that the tenant-aware constraint and Stage B SQL were
executed on 2026-07-24. This repository has not independently verified the
target or its smoke-test results.
