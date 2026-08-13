# Hermes post workflow

This document describes the Stage G workflow. The operational source of truth
for Hermes is [my-mediacrawl-skill](../hermes/skills/my-mediacrawl-skill/SKILL.md).

## State boundary

Capture request, technical outbox, and user-visible post workflow are distinct:

- Capture Worker is a permanent PM2 process. It immediately claims accepted
  requests; it is not a timed Cron task.
- `collection_capture_outbox.status = sent` is only delivery acknowledgement.
  It never means the post was researched, tested, rewritten, or completed.
- `collection_post_workflows.stage/status` is the authoritative user-facing
  lifecycle: base analysis → triage → preprocessing → research/review →
  approved actions → complete.
- Every approved plan ends with a mandatory `vault_note`; completion is blocked
  until the note is written to Claude-Obsidian with `collection_posts.id` and
  the source URL. See the skill's Vault note reference for the JSON contract.

URL capture runs the existing category/summary/tags analysis in Capture Worker.
Image capture stores private media first; Hermes performs image inspection and
analysis before triage.

## Hermes Cron Pull

Hermes is driven by its own Cron Pull. `scripts/hermes/media-inbox-gate.py`
delegates to `agent:cron:claim`, which atomically claims one row from
`collection_post_workflows` and owns a singleton lease in Supabase. It never
reads a Hermes dispatch table and it never starts a resident local worker.

The gate returns `wakeAgent=false` when there is no available workflow or when
another Hermes run owns the lease. The five-minute `preprocess` queue ignores
`research` and `review/awaiting_user`; those are handled by separate research
or decision runs. A run must use the claimed `workflow_id` only, heartbeat
long work, and release the lease after it persists its result. Claiming is FIFO
across the complete available queue, including historical rows; there is no
date cutoff.

The scheduled preprocess prompt should say:

```text
Use /my-mediacrawl-skill. The gate has already claimed exactly one workflow.
Process only its workflow_id with identity hermes:cron:media-inbox. For
base_analysis image work, materialize/inspect/write image analysis, then create
the structured preprocess result and run agent:preprocess. For triage/processing,
create the structured preprocess result and run agent:preprocess. Complete all
high-confidence, low-risk work, write source notes, and persist research or
review requests in Supabase. Do not ask the user during this run. Networked
POC, credentials, package installation, deployment, publishing, and formal
project edits remain deferred. agent:preprocess owns lease release. Respond
[SILENT] after a persisted result; report only systemic failures.
```

The preprocess JSON must include `automation.outcome` (`complete`,
`research_pending`, or `review_pending`), per-domain confidence scores, and
`automation.risk_level` (`low`, `medium`, or `high`). Missing safety evidence
is treated as high risk. A networked, credentialed, package-install, paid API,
or external-side-effect POC must be marked `network_required` and deferred;
offline secret-free POCs may run when confidence is high.

For interactive work, the user asks Hermes to “處理一篇貼文”; Hermes runs
`npm run agent:next -- --interactive`, shows the selected source, then follows
the skill. It never asks the user for an outbox ID.

A separate research Cron sets `HERMES_CRON_QUEUE=research`, claims one
`research/pending` row, performs the research, and runs `agent:research`. It
also persists any approval question instead of prompting during the Cron tick.

## Deployment and verification

Deploy `database/deployments/stage_g_post_workflow.sql` after its listed
prerequisites, then deploy Stage J cleanup and restart only the existing API
server and Capture Worker PM2 processes. See [post_workflow.md](post_workflow.md)
for the workflow deployment note. No third permanent worker is required.

The browser reads workflow state from `/api/posts` and refreshes it while the
user is signed in. Folder scope is optional background and project context; it
does not authorize research, POC, rewrite, or publishing.

There is no POC worker, cron worker, Phase 1 tool verifier, Phase 2 runner, or
`node-tool-verifier` container in this project. POC proposal persistence uses
`agent:poc:propose`; explicit execution uses `agent:poc:run` and the existing
on-demand Docker `node-runner`/`python-runner` services.
