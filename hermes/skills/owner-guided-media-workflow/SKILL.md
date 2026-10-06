---
name: owner-guided-media-workflow
description: Use when capturing a post, organizing a source into Topics or projects, finding a remembered source, continuing an interrupted knowledge task, or discussing an approved POC or deployment in this project.
---

# Owner-Guided Media Workflow

Use this as the primary conversational workflow for this project. Its core
rule is simple: raw evidence may be captured automatically; every semantic or
external effect stays a visible candidate until the Owner explicitly accepts
it.

## Response contract

At the start of every working reply, say these three things in plain language:

1. **目前階段** — one of capture, source repair, candidate review, Topic
   knowledge, project/POC review, Library retrieval, or deployment.
2. **為什麼現在在這裡** — the evidence or decision that caused this stage.
3. **唯一下一步** — one concrete action the Owner can take, or the action the
   agent is performing now.

End each completed stage with its evidence: changed record/file, test or
readback, and what did **not** happen. Do not make the Owner remember hidden
state, infer a workflow stage, or supply a technical identifier unless it is
shown in the interface.

## The workflow

### 1. Capture raw evidence

Accept a public URL or a private image. Create or observe only the durable
**原始來源** and its capture status. A completed capture is retrievable source
evidence, not a folder, a **貼文學習筆記**, a Topic, a project reference, or
an approval.

- Complete source: offer the single action **建立候選整理**.
- **部分擷取**: first show what is missing and offer source repair or
  **以目前來源建立候選**. The agent must not 自動 create semantic candidates
  from a partial source.
- Failed source: show the safe retry path and preserve the failure evidence.

### 2. Create and review candidates

Only after the Owner starts candidate review, prepare drafts for at most one
folder, an optional **貼文學習筆記**, one primary Topic plus up to two related
Topics, Topic knowledge deltas, and relevant project references.

For every candidate, show source evidence, why it was suggested, what an
acceptance changes, and one control: accept, edit then accept, reject, or
defer. The agent must not turn a candidate into **正式知識** without a clear,
recorded **明確接受** action. A skipped/empty post learning note is valid.

### 3. Build independent Topic knowledge

A Topic is not a repository and a post may connect to **多個 Topic**. Keep two
layers separate:

- the post's own learning note may be absent; and
- a Topic holds concise, cited, Owner-accepted aggregate knowledge across
  sources.

Suggest existing project/repository references only as candidates. State why a
reference may be useful and what remains uncertain. Never create or modify a
project workspace merely because a Topic matched.

### 4. Research and POC

Keep POC planning separate from Topic acceptance. A safe local proposal may be
recorded as a candidate. Network access, credentials, package installation,
external writes, repository mutation, publishing, or deployment require a
separate Owner instruction naming that exact action and target. Report the
scope, evidence to collect, stop condition, and rollback before execution.

### 5. Find and continue work

Use **Library** for recalled wording, author/context clues, raw source terms,
and accepted knowledge. Explain why each result matched. Pending candidates
stay excluded by default and are shown only when the Owner asks to include
them.

When work resumes after interruption, inspect the current packet/source rather
than assuming. Restate the three response-contract fields, then continue only
the next unfinished action.

### 6. Deploy only by an explicit gate

Before **部署**, show the target, branch/revision, dirty-worktree impact,
migration list, backup/readback proof, services to restart, smoke test, and
forward recovery. Do not push, overwrite a checkout, apply a remote migration,
restart a process, or remove legacy data without direct Owner authorization.

## Completion check

Call a post complete only when its raw source is retained and the Owner's
chosen review actions are visible and evidenced. Do not require a folder, a
note, a Topic, a project, a POC, or deployment when the Owner intentionally
declines them. A workflow is complete when the current Owner decision is
clear, retrievable, and has no hidden required next step.
