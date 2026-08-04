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
  lifecycle: base analysis → triage → strategy → approved actions → complete.

URL capture runs the existing category/summary/tags analysis in Capture Worker.
Image capture stores private media first; Hermes performs image inspection and
analysis before triage.

## Hermes scheduling

The optional Hermes Cron must run `scripts/hermes/media-inbox-gate.py`. The gate
calls `agent:next` (not the technical outbox inbox) and wakes Hermes only for a
safe retryable/`pending` workflow. It intentionally ignores
`strategy/awaiting_user`: that state needs a human conversation, not another
automated run.

The scheduled prompt should say:

```text
Use /my-mediacrawl-skill. Read the gate workflow result and process exactly one
selected workflow with identity hermes:cron:media-inbox. For base_analysis image
work, claim/materialize/inspect/write image analysis; for triage/pending, run
agent:triage. Stop at strategy/awaiting_user. Never invent an action plan,
execute a POC, publish, install packages, deploy, or modify project source.
Report failures; respond [SILENT] only when wakeAgent is false.
```

For interactive work, the user asks Hermes to “處理一篇貼文”; Hermes runs
`npm run agent:next -- --interactive`, shows the selected source, then follows
the skill. It never asks the user for an outbox ID.

## Deployment and verification

Deploy `database/deployments/stage_g_post_workflow.sql` after its listed
prerequisites, then restart the existing API server and Capture Worker PM2
processes. See [post_workflow.md](post_workflow.md) for the exact deployment
note. No third permanent worker is required.

The browser reads workflow state from `/api/posts` and refreshes it while the
user is signed in. Folder scope is optional background and project context; it
does not authorize research, POC, rewrite, or publishing.
