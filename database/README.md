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
- `deployments/schema_aggregator.sql` — category/domain upgrade. Its current
  `source_domains` definition matches Stage B (`text[]`). Environments that
  previously applied an older JSONB version still require the preflight in the
  Stage B deployment guide before they accept new captures.

Stage H/I deployment files remain as historical source records only. They must
not be re-applied after Stage J; the active Hermes integration is Cron Pull.

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
