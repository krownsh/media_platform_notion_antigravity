---
name: my-mediacrawl-skill
description: Operate this project's resumable media workflow. Use when a user asks Hermes to process a captured post, continue a failed post, inspect a private uploaded image, discuss research or POC strategy, or create a source-only or research-backed draft.
---

# Media workflow

Use only the repository's `agent:*` commands from the repository root. Let the
scripts load `server/.env`; never read, print, copy, or request secrets.

The API Server and Capture Worker are separate always-on PM2 processes. The
Capture Worker is not a Cron job: an upload creates a durable request and the
worker takes it as soon as it is available.

## Lifecycle and vocabulary

There are three independent states. Never collapse them into one word.

1. **Capture request**: `accepted`, `extracting`, `finalized`, `degraded`, or
   `failed`. `finalized` only means the source was stored.
2. **Technical outbox**: `pending`, `processing`, `sent`, or `failed`.
   `sent` means Hermes consumed the delivery event. It never means all work on
   the post is finished.
3. **Post workflow**: a user-visible `stage` plus `status`.

   - `base_analysis`: source analysis is pending, processing, completed, or failed.
   - `triage`: classify and understand the source.
   - `strategy`: show the source and discuss what to do; normally `awaiting_user`.
   - `actions`: execute only actions the user explicitly approved.
   - `complete`: every requested action is terminal.

Do not mark a workflow complete merely because it has no folder yet. Folder
placement is organisation, not authorization.

## Source handling

- **URL**: Capture Worker extracts content and runs the existing capture-time
  category/summary/tags analysis. Hermes then performs triage.
- **Image**: Capture Worker stores private media only. Hermes must materialize
  and inspect it, record OCR/description/summary/tags, then triage it.

## Selection rule: “處理一篇貼文”

When the user says “處理一篇貼文”, “繼續處理”, or equivalent, do not ask for an
Outbox ID. Run:

```bash
npm run agent:next -- --interactive
```

The result selects one workflow in this order:

1. A retryable failure from the previous run.
2. The latest workflow waiting for the user's strategy decision.
3. The latest incomplete workflow.

Show the selected source before discussing or acting: title, URL or image,
summary, category, completed stages, failed stage/error, and current action
plan. Resume only the failed step; do not redo completed work.

For a scheduled run, omit `--interactive`. It may safely finish base analysis
and triage for one item. It must stop at `strategy/awaiting_user`; it must not
invent a user decision, publish, install packages, modify the formal project,
or execute a POC.

After selection, follow the selected stage exactly: for `base_analysis` image
work, perform the image steps below; for `triage/pending`, run `agent:triage`;
for `strategy/awaiting_user`, stop and ask the user. Do not run a second item
in the same scheduled invocation.

## Command map

| Purpose | Command |
| --- | --- |
| Select one resumable workflow | `npm run agent:next -- --interactive` |
| Select one safe scheduled workflow | `npm run agent:next` |
| Read legacy technical outbox diagnostics | `npm run agent:inbox -- --json --limit 10` |
| Claim private image delivery | `npm run agent:claim -- <outbox-id> --agent <identity>` |
| Materialize private image media | `npm run agent:media -- <outbox-id>` |
| Record image analysis and advance to triage | `npm run agent:image-analysis -- <outbox-id> --agent <identity> --file <analysis.json>` |
| Triage a workflow | `npm run agent:triage -- <workflow-id> --agent <identity>` |
| Persist the user-approved action plan | `npm run agent:decide -- <workflow-id> --agent <identity> --file <action-plan.json>` |
| Record an action result | `npm run agent:complete-action -- <workflow-id> <action-type> --agent <identity> --status completed --file <outcome.json>` |
| Create an approved draft without publishing | `npm run agent:create-draft -- <workflow-id> <fast_rewrite|content_synthesis> --agent <identity>` |
| Release a transient technical outbox lease | `npm run agent:release -- <outbox-id> --agent <identity> --available-at <ISO-8601>` |
| Record a technical delivery failure | `npm run agent:fail -- <outbox-id> --agent <identity> --stage <stage> --error <safe-message>` |

Use one stable identity, for example `hermes:cron:media-inbox`, for every
claim/write/release operation in the same run.

## Image base analysis

Load [references/image-analysis.md](references/image-analysis.md) before
creating image analysis JSON.

1. Claim exactly one image outbox item.
2. Materialize it with `agent:media`; use only returned local paths.
3. Inspect every materialized image. Do not infer unreadable text.
4. Write analysis JSON under 128 KB.
5. Run `agent:image-analysis`.
6. Its success means **image base analysis** is complete and the workflow is
   now `triage/pending`. It does not mean the whole post is complete.

If the materialization, inspection, or writeback fails, record a bounded,
secret-free failure. Do not create an immediate retry loop.

## Triage and strategy

For a workflow at `triage/pending`, run `agent:triage`. It records the current
category/summary and investigation candidates, then moves the post to
`strategy/awaiting_user`.

At this point discuss the post with the user. Typical response structure:

```text
這篇是什麼／為何值得注意
目前分類與尚未確認的地方
建議研究或專案比對方向
是否值得最後整理成內容草稿
```

Do not treat a folder as a command. `collection_topic_scopes` is optional
background (folder objective and possible projects); it cannot bypass this
discussion.

After the user decides, save an action plan JSON such as:

```json
{
  "actions": [
    { "type": "research", "notes": "確認 claims、限制與替代方案" },
    { "type": "poc_proposal", "notes": "針對目前專案評估可行性" }
  ]
}
```

Valid action types are `research`, `poc_proposal`, `poc_execute`,
`fast_rewrite`, and `content_synthesis`. An empty `actions` array means the
user chose to keep the classified bookmark only.

## Content output

Rewrite is an output stage, not a default triage route.

- `content_synthesis`: after research, project comparison, or a test, create a
  new draft based on the source plus our conclusions. Preserve source
  attribution and distinguish verified facts from our opinion.
- `fast_rewrite`: only when the user explicitly asks to quickly adapt or
  recreate the source. Mark its outcome `content_basis: "source_only"`.

Neither action publishes automatically. If research or validation informed the
draft, record `content_basis: "researched"` or `"validated"` in the outcome.

For an approved `fast_rewrite` or `content_synthesis`, use
`agent:create-draft`; it persists a content asset and marks only that action
completed. `content_synthesis` requires a completed research or POC-related
action first. The command never publishes.

## POC and project safety

`poc_proposal` may analyse fit and prepare a proposal. `poc_execute` requires
an explicit user instruction for this exact workflow. Before executing, state
the selected workflow, project, and isolated scope. Never alter the formal
project, deploy, publish, or install production dependencies without a new
explicit approval.

## Completion and failures

A post reaches `complete/completed` only when every user-approved action is
`completed` or `skipped`. If an action fails, store its bounded error and keep
the workflow retryable. If attempts are exhausted or manual information is
needed, mark it `blocked` and explain the blocker to the user.

Private media remains private. Never substitute a signed URL, arbitrary
Storage path, or unrelated local file for a materialized image.
