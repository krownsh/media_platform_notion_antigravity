# Hermes pull-based outbox workflow

> Execution note (2026-07-29): Hermes does not run on the current Windows
> development machine. Installation, Gateway, Cron, delivery, and cross-machine
> E2E work are deferred to
> [`todo/2026-07-29_Hermes遠端主機接線與E2E驗收.md`](../todo/2026-07-29_Hermes遠端主機接線與E2E驗收.md).
> Do not configure Hermes on this machine.

## Decision

`POST /api/process` stops after crawler ingestion, database finalization, and a
`source.ingested.v1` outbox write. The backend does not run a resident dispatcher.

Hermes Agent periodically checks the inbox. A pre-check wakes the LLM only when
an unlocked `pending` row exists. Hermes claims one row, reviews it, persists a
proposal or a stored-only decision, reports errors, and releases the lease.

For a direct image upload, the outbox contains stable private Storage
`storage_bucket`/`storage_path` metadata. Hermes must materialize that specific
outbox item's image before visual analysis; temporary signed URLs are never
persisted in the event or post record.

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
npm run agent:media -- <image-outbox-id>
```

```bash
# macOS
node scripts/agent-sdk/get-inbox.js --json --limit 10
node scripts/agent-sdk/get-inbox.js --status failed --json --limit 10
npm run agent:media -- <image-outbox-id>
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

`agent:media` validates that the event belongs to the same tenant as an
`image` post, permits only `CAPTURE_IMAGE_BUCKET` paths under that user's
`captures/` prefix, and writes mode-0600 files below the operating system temp
directory. Hermes inspects the returned `local_path`, creates a JSON object with
`summary` and optional `description`, `ocr_text`, `tags`, `topics`,
`primary_category`, and `sentiment`, then persists it with:

```bash
npm run agent:image-analysis -- <outbox-id> --agent hermes:cron:media-inbox --file <analysis.json>
```

The write-back RPC derives tenant and post identity from the outbox ID and only
accepts direct image captures. It replaces the same outbox's prior image insight
instead of appending duplicates. The default analysis command must not
include `--execute-poc`; that flag is reserved for an explicit user-approved
POC action.

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
  "Use MEDIA_PLATFORM_PROJECT_ROOT. Read at most 10 pending items with node scripts/agent-sdk/get-inbox.js --json --limit 10. Process only the oldest item. If it has private image media, run npm run agent:media -- <outbox-id>, inspect every returned local_path, create the bounded image-analysis JSON, and persist it with npm run agent:image-analysis -- <outbox-id> --agent hermes:cron:media-inbox --file <analysis.json>. Then run node scripts/agent-sdk/analyze-item.js <outbox-id> --agent hermes:cron:media-inbox. Never use --execute-poc. Never publish, install packages, or modify a project. Report the image description or proposal, or the recorded error; respond [SILENT] only when no item exists." \
  --script media-inbox-gate.py \
  --workdir "/absolute/path/to/media_platform_notion_antigravity" \
  --deliver all \
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

The API now passes the crawler's normalized `title` into finalization. The
deployment adds one nullable column and replaces the existing service-role-only,
`security invoker` finalization RPC.

On 2026-07-29 the user applied
`database/deployments/stage_d_2_article_title.sql`. A read-only verification
confirmed that `collection_posts.title` is readable through the service-role
Data API and that `/rpc/finalize_collection_capture` is exposed. The sampled
legacy row still had a null title, as expected because the migration does not
backfill old captures. A new controlled `/api/process` capture is still required
to verify title persistence end to end.

## Complete rollout checklist

The workflow is not operational merely because the database migration exists.
Finish the following chain in order:

1. **Load the application code in the actual backend runtime.** The current
   implementation is committed locally on `agent-dev`; it has not been pushed
   or deployed. Local runtime and contract verification are completed here;
   remote push／deployment still requires explicit authorization.
2. **Choose the machine that actually runs Hermes.** That machine needs the
   project checkout, Node.js, Python, access to `server/.env`, and a working
   `hermes` CLI. The Windows machine checked on 2026-07-29 had a `.hermes`
   directory but no `hermes` command on `PATH`, so no Cron job was created.
3. **Install the gate and configure the project root.** Copy
   `media-inbox-gate.py` into `~/.hermes/scripts/`, set
   `MEDIA_PLATFORM_PROJECT_ROOT`, restart the Hermes gateway, and run the gate
   once by hand. Database credentials stay in `server/.env` and never go in the
   Cron prompt.
4. **Create the scheduled review with delivery enabled.** Use `--workdir` so
   project rules load, `--script media-inbox-gate.py` so empty polls spend no
   LLM tokens, and `--deliver all` or one explicit configured channel so
   proposals and failures cannot remain only in local logs.
5. **Run one controlled happy-path acceptance test.** Submit a new test article
   through `/api/process`; verify the saved `title`, returned outbox ID, pending
   inbox visibility, one Hermes claim, the stored-only or proposed route result,
   released lease, and delivered Hermes report.
6. **Run one controlled failure drill.** Use a disposable test capture or test
   environment to force analysis failure; verify terminal `failed`, structured
   `last_error`, non-zero command exit, and Hermes delivery. Do not damage a real
   captured article merely to test failure handling.
7. **Confirm the human decision boundary.** `collect` ends at `sent` without an
   action. `research` ends at a pending proposal. `poc_proposal` may be approved
   from the existing POC Workbench, whose execute endpoint requires the literal
   `EXECUTE_POC` confirmation. Content rewriting remains optional and must not
   run for an original-author post unless explicitly requested. Capture and
   classification never create `agent_jobs` automatically.
8. **Operate and audit.** Check pending and failed inboxes periodically, inspect
   `hermes cron runs "Media inbox review" --limit 20`, and keep failed rows until
   a human decides to retry or close them. Do not add a resident dispatcher.

Hermes-specific steps 2–8 are deliberately deferred to the tracked `/todo`
item because Hermes runs on another computer. MVP acceptance is complete only
after steps 1–7 pass across both computers. A database-backed admin
dashboard for pending／processing／failed rows is a later usability improvement,
not a prerequisite for Hermes pull-based operation when delivery is configured.
