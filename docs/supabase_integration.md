# Supabase integration

This document describes the current runtime boundary. It replaces the retired
frontend-side write flow and must not be used to place credentials in source
code.

## Credentials and callers

- The browser uses the public Supabase configuration in its normal client
  environment and sends the user's Supabase JWT to the backend.
- The backend reads `server/.env`; use `SUPABASE_SECRET_KEY` where available,
  or the legacy `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` only on
  the server. Never expose any of them to the browser.
- n8n calls only `POST /api/process` using `x-api-key`; the server maps that
  key to `MEDIA_API_KEY_USER_ID`. The request body must not supply `userId`.
  See [n8n capture setup](n8n_capture_setup.md).

## Database source layout

- [Reference schema](../database/schema/schema.sql)
- [Existing-environment deployment SQL](../database/deployments/)
- [Stage B deployment and smoke test](stage_b_source_finalization_deployment.md)

`database/deployments/` is not Supabase migration history. Apply a deployment
only after reviewing the target schema, then capture verified migration history
with the project's Supabase CLI workflow.

## Runtime write path

```text
browser JWT or mapped n8n API key
  -> POST /api/process
  -> crawler / parser / MiniMax analysis
  -> finalize_collection_capture RPC (service role)
  -> collection_posts + child rows + collection_capture_outbox
```

The `collection_capture_outbox` table and its RPC are deliberately not browser
callable. Their RLS/grants are part of the Stage B deployment.

## Read-only server connection check

From the repository root, after populating `server/.env`:

```bash
node server/scripts/diagnostics/verify_supabase_connection.js
```

The check reads only `collection_posts`; it does not log in a user or alter data.
