---
name: my-mediacrawl-skill
description: Operate this project's Supabase capture outbox for interactive requests and the approved Hermes media-inbox schedule. Use when inspecting new captures, routing captured URLs, materializing and analyzing private image uploads, recording image analysis, matching a capture to the local project, or running an approval-gated isolated POC.
---

# MediaCrawl Inbox

Use the repository's `agent:*` commands as the only execution layer. Run every
command from the repository root.

## Preconditions

- Require `package.json`, `scripts/agent-sdk/`, and `server/.env` in the project.
- Let the scripts load `server/.env`; never read, print, copy, commit, or ask the
  user to paste its secrets.
- Confirm Hermes can discover this skill. Configure the project
  `hermes/skills` directory as a Hermes `skills.external_dirs` entry, then verify
  `/skills` lists `my-mediacrawl-skill` before enabling the Cron.
- Use one stable identity such as `hermes:cron:media-inbox` for claim, write-back,
  release, and failure commands in the same run.
- Do not use raw SQL, a database console, or ad-hoc Supabase commands.

## Authorization modes

- Process an item when the user explicitly requests it, or when the approved
  media-inbox gate returns `wakeAgent=true` with bounded item IDs.
- In a scheduled run, process only the oldest available item. Do not batch all
  pending items in one agent turn.
- A scheduled run may inspect, classify, and analyze an image. It must not run a
  POC, publish, install packages, deploy, or modify project source.
- A `pending` event is never permission to execute a POC or publish content.

## Route by source type

1. Read the gate's `context.items`. If source metadata is absent, run:

   ```bash
   npm run agent:inbox -- --json --limit 10
   ```

2. Select the oldest requested item and inspect `payload.source_type`.
3. For `image_upload`, follow **Analyze a private image**.
4. For `url_capture`, follow **Analyze a captured URL**.
5. For an unknown source type, do not claim it. Report the unsupported value.

## Command map

| Purpose | Command |
| --- | --- |
| Read inbox | `npm run agent:inbox -- --json --limit 10` |
| Claim an image | `npm run agent:claim -- <outbox-id> --agent <identity>` |
| Materialize private image media | `npm run agent:media -- <outbox-id>` |
| Write image analysis and finish outbox | `npm run agent:image-analysis -- <outbox-id> --agent <identity> --file <analysis.json>` |
| Release a transiently blocked item | `npm run agent:release -- <outbox-id> --agent <identity> --available-at <ISO-8601>` |
| Record a terminal processing failure | `npm run agent:fail -- <outbox-id> --agent <identity> --stage <stage> --error <safe-message>` |
| Analyze a URL capture | `npm run agent:analyze -- <outbox-id> --agent <identity>` |
| Run an approved isolated POC | `npm run agent:analyze -- <outbox-id> --agent <identity> --execute-poc` |

## Analyze a private image

Load [references/image-analysis.md](references/image-analysis.md) before creating
the result JSON.

1. Claim exactly one image outbox ID with `agent:claim`.
2. Run `agent:media` for that ID. Use only the returned `local_path` files.
3. Visually inspect every returned file. Do not infer text that is not legible.
4. Write one JSON file matching the reference contract. Keep it at or below
   128 KB and do not include secrets or unrelated local data.
5. Run `agent:image-analysis` with the same identity that owns the lease.
6. Treat the operation as successful only when it returns `ok: true` and
   `status: "sent"`. This command records the analysis, clears the lease, and
   completes the outbox; do not run `agent:complete` afterward.

If any step after claim fails, record a bounded, secret-free failure with
`agent:fail`. Use stages `image.materialize`, `image.inspect`, or
`image.writeback`. Use `agent:release` only for a genuinely transient condition
that should be retried later; never create an immediate retry loop.

## Analyze a captured URL

1. Require a concrete outbox ID.
2. Run `agent:analyze` with the scheduled or interactive Hermes identity. This
   command owns its URL claim/release/failure lifecycle.
3. Report routes, repository audit findings, and application matches.
4. Do not add `--execute-poc` unless the user explicitly approves an isolated
   POC for that exact item.

## Run an isolated POC

1. Require an explicit instruction such as “執行 POC”, “做隔離測試”, or
   “run the isolated POC”.
2. State the selected capture and that execution is limited to
   `sandbox/jobs/<outbox-id>`.
3. Run `agent:analyze` with `--execute-poc`.
4. Report the job ID, pass/fail result, timeout state, and bounded stdout/stderr.
5. Do not modify the formal project, install production dependencies, commit,
   deploy, publish, or change Supabase schema.

## Safety and verification

- Never expose the service-role key. Private media must remain in the
  permission-restricted temporary directory returned by `agent:media`.
- Never substitute a browser signed URL, arbitrary Storage path, or unrelated
  local image for the returned materialized file.
- Never process an image without first owning its lease.
- On success, verify the image command returns `status: "sent"` so the Cron will
  not repeatedly process the same outbox item.
- If configuration, claim, media validation, or write-back fails, show the real
  bounded error. Do not fabricate success or silently skip the item.
