# Hermes pull-based outbox workflow

## Decision

`POST /api/process` stops after crawler ingestion, database finalization, and a
`source.ingested.v1` outbox write. The backend does not run a resident dispatcher.

Hermes Agent periodically checks the inbox. A pre-check wakes the LLM only when
an unlocked `pending` row exists. Hermes claims one row, reviews it, persists a
proposal or a stored-only decision, reports errors, and releases the lease.

This workflow deliberately does not write `source_routes`. The existing
`collection_capture_outbox.payload.agent_routes` is the single route-plan record
for the current MVP. `agent_jobs` are created only after a human approves a
specific action; capture or route classification must never create an execution
job automatically.

An active `research` topic scope adds a pending `research_content` proposal to
the route plan. It does not run web research by itself; Hermes reports the
proposal and waits for an explicit decision.

## Lifecycle

```text
pending
  Hermes has not completed review of this capture. locked_by identifies an
  active claimant; if that process dies, the pending row becomes reclaimable
  after the lease window.

processing
  Hermes successfully persisted a route plan. One or more proposed routes
  still await a user decision or explicit route execution.

sent
  The source was intentionally stored-only, or every approved route reached a
  terminal state.

failed
  Hermes or a route failed. last_error contains structured stage, agent,
  timestamp, error type, and message data. There is no silent retry loop.
```

The optimistic lock uses `updated_at`; the lease uses `locked_at` and
`locked_by`. A stale lease can be reclaimed after the configured lease window.

## Project commands

Read without changing state:

```powershell
# Windows PowerShell
node scripts/agent-sdk/get-inbox.js --json --limit 10
node scripts/agent-sdk/get-inbox.js --status failed --json --limit 10
```

```bash
# macOS
node scripts/agent-sdk/get-inbox.js --json --limit 10
node scripts/agent-sdk/get-inbox.js --status failed --json --limit 10
```

Hermes-safe proposal run:

```powershell
# Windows PowerShell
node scripts/agent-sdk/analyze-item.js <outbox-id> --agent hermes:cron:media-inbox
```

```bash
# macOS
node scripts/agent-sdk/analyze-item.js <outbox-id> --agent hermes:cron:media-inbox
```

The default command must not include `--execute-poc`. That flag is reserved for
an explicit user-approved POC action.

Manual lease diagnostics:

```powershell
# Windows PowerShell
npm run agent:claim -- <outbox-id> --agent hermes:manual
npm run agent:release -- <outbox-id> --agent hermes:manual
npm run agent:fail -- <outbox-id> --agent hermes:manual --stage inspect --error "reason"
```

```bash
# macOS
npm run agent:claim -- <outbox-id> --agent hermes:manual
npm run agent:release -- <outbox-id> --agent hermes:manual
npm run agent:fail -- <outbox-id> --agent hermes:manual --stage inspect --error "reason"
```

## Hermes Cron pre-check

Hermes requires pre-run scripts under its own `~/.hermes/scripts/` directory.
Copy the tracked cross-platform gate there and point it at this checkout.

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.hermes\scripts"
Copy-Item scripts\hermes\media-inbox-gate.py "$env:USERPROFILE\.hermes\scripts\media-inbox-gate.py"
setx MEDIA_PLATFORM_PROJECT_ROOT "G:\media_platform_notion_antigravity"
```

Restart the Hermes scheduler after `setx` so it receives the environment value.

macOS Terminal:

```bash
mkdir -p ~/.hermes/scripts
cp scripts/hermes/media-inbox-gate.py ~/.hermes/scripts/media-inbox-gate.py
export MEDIA_PLATFORM_PROJECT_ROOT="/Volumes/DevSSD/media_platform_notion_antigravity"
```

Persist the macOS environment value in the service or shell configuration that
starts Hermes; do not hard-code database credentials in the Cron prompt or gate.

Example scheduled agent job:

```bash
hermes cron create "every 30m" \
  "Use MEDIA_PLATFORM_PROJECT_ROOT. Read at most 10 pending items with node scripts/agent-sdk/get-inbox.js --json --limit 10. Process only the oldest item with node scripts/agent-sdk/analyze-item.js <outbox-id> --agent hermes:cron:media-inbox. Never use --execute-poc. Never publish, install packages, or modify a project. Report the proposal or the recorded error; respond [SILENT] only when no item exists." \
  --script media-inbox-gate.py \
  --name "Media inbox review"
```

Run `hermes cron run <job-id>` once after creation and verify the delivered
result before leaving the schedule enabled.

## Failure handling

- Claim conflicts return a non-zero exit and do not overwrite the other agent.
- `analyze-item.js --agent ...` writes a structured terminal failure when a
  claimed run raises an error.
- A failed item is excluded from the normal pending gate and remains visible via
  `--status failed` until a human decides whether and how to retry.
- Service-role credentials remain in the backend project environment. Hermes is
  instructed to call the allowlisted CLI instead of running arbitrary SQL.

## Article title deployment

The API now passes the crawler's normalized `title` into finalization. Existing
databases must apply
`database/deployments/stage_d_2_article_title.sql` before titles are persisted.
The deployment adds one nullable column and replaces the existing
service-role-only, `security invoker` finalization RPC. It does not run merely
because the file exists.
