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
- `deployments/schema_aggregator.sql` — category/domain upgrade. Its current
  `source_domains` definition matches Stage B (`text[]`). Environments that
  previously applied an older JSONB version still require the preflight in the
  Stage B deployment guide before they accept new captures.

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
