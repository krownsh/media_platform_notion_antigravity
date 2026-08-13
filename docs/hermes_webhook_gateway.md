# Hermes webhook gateway

Stage H adds a durable, non-blocking wake-up path from a newly initialized post
workflow to Hermes Agent. It does not replace the Hermes host. Hermes remains
the agent execution machine; only the transport into Hermes changes from a
Cron-only pull to event-driven delivery.

The route must execute `agent:webhook` as its first tool call. For a URL
workflow already at `triage/pending`, that command performs the deterministic
triage transition immediately. Image base analysis remains an Agent task
because Hermes must inspect the private material before triage.

## State boundaries

Four states remain independent:

1. `collection_capture_requests`: source acquisition and storage.
2. `collection_capture_outbox`: source delivery consumed while Hermes processes
   URL or private image material.
3. `collection_hermes_dispatches`: whether Hermes accepted a wake-up webhook.
4. `collection_post_workflows`: the authoritative end-to-end post lifecycle.

`collection_hermes_dispatches.status = delivered` means only that the current
Hermes gateway returned `202 accepted`, `200 delivered`, or `200 duplicate`
for the same stable `X-Request-ID`. It never marks a post workflow complete.

The dispatcher intentionally has its own outbox. Claiming the existing capture
outbox before Hermes starts would steal the lease that image analysis and
triage need.

## Deployment order

1. Configure Hermes with
   `hermes/config/webhook-route.example.yaml` and a real HMAC secret.
2. Verify the Hermes host locally with `GET /health` and a signed test event.
3. Set `HERMES_WEBHOOK_URL` and `HERMES_WEBHOOK_SECRET` in `server/.env`.
4. Generate and review a formal migration from
   `database/deployments/stage_h_hermes_webhook_dispatch.sql`.
5. Apply the migration to the shared Supabase project.
6. Apply `database/deployments/stage_i_hermes_single_agent.sql` and its Stage I
   follow-up migrations. Do not start a resident Hermes dispatcher; Capture
   completion, Hermes Cron, or a manual command performs one dispatch attempt.

After changing the route contract, deploy all three pieces together on the
Hermes Mac:

1. Pull the repository `main` branch so `agent:webhook` exists locally.
2. Sync `hermes/skills/my-mediacrawl-skill` through the shared
   `~/.my-main-agent` skill-management flow.
3. Merge `hermes/config/webhook-route.example.yaml` into the active everynote
   profile without replacing its real route secret.
4. Restart the Hermes Gateway. The API Server does not need a restart for this
   Agent command, but any stale Capture or Dispatcher PM2 process should still
   be restarted with `--update-env` when its own code or environment changed.

For a URL smoke test, success is not merely
`collection_hermes_dispatches.status = delivered`. The matching
`collection_post_workflows` row must move from `triage/pending` to
`strategy/awaiting_user` and contain `context.triage.status = completed`.

Webhook delivery itself does not write Vault files. The confirmed Vault is
`~/.hermes/claude-obsidian`; Hermes may write there only when the workflow later
reaches its mandatory `vault_note` action. Before the first write, open that
directory once as an Obsidian Vault and run `npm run agent:vault:check` on the
Hermes host. `/Volumes/DevSSD/claude-obsidian` remains the tool checkout.

The Capture Worker still owns the capture queue and may poll it. That is separate
from Hermes dispatch: there is no Hermes-side timer loop consuming this table.

The deployment does not backfill existing workflows. This is deliberate: the
shared database already has a large triage backlog, and automatically waking
all of it would create an uncontrolled burst of agent work and token usage.
Backfill must be a separate rate-limited operation after the new-source path is
verified.

## Delivery and retry contract

- The body contains only `dispatch_id`, `workflow_id`, `post_id`, event type,
  and schema version. Captured content is loaded from Supabase after wake-up.
- This deployment uses the Gateway's legacy generic header
  `X-Webhook-Signature`, which signs the raw body only with HMAC-SHA256. Keep
  the Worker and installed Gateway contract tests aligned before migrating to
  the replay-resistant V2 header.
- `X-Request-ID` is the dispatch's stable UUID across retries.
- Network errors, timeouts, `408`, `429`, and `5xx` are retried with bounded
  exponential backoff.
- Authentication and route errors (`401`, `403`, `404`) go directly to
  `dead_letter` because retrying cannot fix the configuration.
- After the maximum attempts, a dispatch moves to `dead_letter`; its post
  workflow remains available for reconciliation or manual processing.

## Security

- HTTPS is required except for loopback development.
- `INSECURE_NO_AUTH` is rejected by the application client.
- The webhook prompt receives identifiers only, never raw captured content.
- A signed payload authenticates the dispatcher, not the captured post. Hermes
  must continue treating source text, OCR, websites, and tool output as
  untrusted data.
- Webhook delivery does not authorize POC execution, project modification,
  publishing, deployment, paid APIs, or use of secrets.

## POC automation policy

The first unattended policy allows only a deterministic POC that is:

- executed in the existing network-disabled, read-only Docker sandbox;
- based only on standard-library code;
- given no secrets, host paths, subprocess escape, or production writes;
- subject to the existing CPU, memory, output, and time limits;
- supported by executable assertions and persisted evidence.

Integration POCs that need network access, third-party installation, secrets,
paid services, or formal project changes continue to require an explicit user
decision. Confidence may select a safe action, but it does not grant authority.

## Knowledge matching decision

This project does not store embeddings and does not use a vector extension or
vector similarity search. Exact matching uses platform IDs, canonical URLs,
canonical entity keys, and normalized content hashes. Candidate related items
may be retrieved with PostgreSQL full-text search and `pg_trgm`; Hermes makes
the final `same`, `related`, or `different` decision from cited source evidence.
