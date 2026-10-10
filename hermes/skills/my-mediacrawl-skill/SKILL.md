---
name: my-mediacrawl-skill
description: The owner-guided media collection workflow. Use for capture, review, Topic knowledge, project references, Library retrieval, approved POCs, and the local Obsidian post case file.
---

# Owner-Guided Media Collection Workflow

`my-mediacrawl-skill` is the compatibility name for the current workflow. It
is not the former Hermes/Cron/legacy-Vault workflow. Do not invoke legacy
`agent:*` commands, legacy queues, old Vault paths, Knowledge Space, automatic
preprocessing, or a background workflow merely because this skill name was
used.

The governing rule is simple: **raw source evidence and its provisional local
record may be created automatically; every semantic or external effect remains
a visible candidate until the Owner explicitly accepts it.**

Keep **原始來源**、**候選**、and **正式知識** visibly separate. Only a recorded
**明確接受** may promote a candidate into formal knowledge.

## Response contract

At the start of every working reply, state these three items in plain,
non-technical language:

1. **目前階段** — one of 擷取、來源修復、候選審核、Topic 知識、專案／POC 審核、Library 查找、部署。
2. **為什麼現在在這裡** — the persisted source, visible candidate, decision, or failure that caused this stage.
3. **唯一下一步** — exactly one concrete Owner action, or the one action the agent is currently performing.

At the end of a completed stage, show the evidence (record, case-file event,
or verified result), what changed, and what did **not** happen. Never require
the Owner to remember a hidden state, a workflow ID, a CLI command, or the
next stage. If work resumes, inspect the current source/review packet first
and restate this contract before continuing.

## 1. Capture raw evidence

Accept a public URL or a private image. URL acquisition is crawler-only: do
not claim that an official platform API, API fallback, token, or rate-limit
protection is active unless it has separately been implemented and verified.

A successful capture persists only source facts: URL or upload identity,
platform, captured body, media references, comments, capture metadata, and an
immutable source revision. It is not an accepted folder, **貼文學習筆記**,
Topic, Project reference, POC, or publication.

Source quality is explicit:

- **完整來源** — prepare the visible Review Packet and its candidates.
- **部分擷取** — say precisely what is missing; offer either repair or the
  explicit Owner action **以目前來源建立候選**. Do not create semantic
  candidates first.
- **擷取失敗** — retain failure evidence and offer the safe retry path. It has
  no source revision and cannot enter candidate review.

### Provisional local post case file

Once a complete or partial source revision is persisted, the local
`media-collection-server` may automatically try to create its **provisional
Inbox case file**. This is durable source evidence, not semantic acceptance and
not a browser filesystem write. The browser talks only to the authenticated
collection API; the local server validates the Vault root and returns relative
paths only.

The approved root is:

```text
/Volumes/DevSSD/10_Projects/Personal/media_collection
```

The initial path is:

```text
Media Knowledge/Posts/Inbox/YYYY-MM-DD｜暫定：<title>｜<post-id-8>.md
```

The file is one continuous Markdown case file, internally keyed by `post_id`.
Its initial snapshot contains readable source text, media references, and
source comments. Do **not** write JSON walls into the Markdown file; raw
structured evidence remains in Supabase. The case file must identify itself as
provisional and say that the next action is review.

Local delivery has its own state: pending, synchronized, failed, local change
pending, or conflict. A write failure is visible and retryable but never
rolls back a captured source, erases candidates, or falsely closes review.

## 2. Review automatically prepared candidates

For a complete source, prepare visible drafts only: at most one primary-folder
proposal, an optional post learning note, one primary Topic plus up to two
related Topics, Topic knowledge deltas, and relevant Project references. A
post learning note may be intentionally empty (`not_needed`).

For each candidate show:

- source evidence and why it was suggested;
- what acceptance would change;
- the clear choices: accept, edit then accept, reject, or defer.

No automatic process may accept, promote, rename, move, or otherwise turn a
candidate into **正式知識**. A direct folder selector is an explicit Owner
action and must use the same audited reviewed-promotion path; browser clients
must never write folders directly.

The accepted primary folder, if any, is the only authority for a formal
physical post path and accepted filename. Until then the case file stays in
Inbox with its provisional title. Moving or renaming is a safe single-file
operation recorded as an appended event, never a duplicate file.

## 3. Keep the three knowledge layers separate

1. **Post case file** — the complete per-post record: source snapshot,
   post-scoped Owner/agent discussion, analysis, candidates, accept/reject
   decisions, research, POC outcomes, and append-only history.
2. **Post learning note** — optional, post-specific learning. It may be
   absent and must never be fabricated just to complete the workflow.
3. **Topic knowledge** — a clean, cited, Owner-accepted cross-source
   synthesis. It does not copy a whole post or candidate discussion.

A Topic is independent of repositories, a post may connect to multiple Topics,
and Topic creation never requires a Project. Project/repository references are
only candidates; acceptance records why they may help and does not modify a
workspace.

Only accepted Topic and Project records update their aggregate Markdown notes.
Rejected or deferred ideas remain traceable in the post case file without
polluting a Topic, Project, or search result as formal knowledge.

## 4. Local case-file ownership and history

The case file contains a system-managed current state, a source snapshot, an
append-only event log, and an Owner-owned free-notes section. Never overwrite
free notes. Every post-scoped discussion or analysis that materially informs a
decision is appended with its source/candidate/accepted/rejected/limitation
status and a concise conclusion. General chat that is unrelated to that post
is not copied into the file.

Later accepted decisions refresh only the current-state view and append a new
event; historic events are never regenerated. A locally edited free-note area
is a reviewable mirror candidate, not an automatic online update. A change to
a system-managed block is a conflict requiring an explicit Owner choice.

## 5. Research, POC, drafts, and deployment

Research or a POC is separate from Topic acceptance. A POC proposal may be
recorded as a candidate. Network access, credentials, package installation,
external writes, repository mutation, publishing, process restart, or
deployment require a separate, explicit Owner instruction that names the
action and target. Before execution state the scope, evidence to collect, stop
condition, and rollback/recovery path.

Never infer authorization from a Topic, folder, Project reference, candidate,
or old workflow. A completed POC has an evidence-backed outcome (`adopt`,
`defer`, or `reject`) and does not silently alter a real project.

Before deployment, show target, branch/revision, dirty-worktree impact,
migrations, backup/readback proof, services to restart, smoke test, and
forward recovery. Do not push, migrate, restart, overwrite, or delete without
direct Owner approval.

## 6. Library retrieval

Use **Library** to find a remembered source from wording, author/context clues,
raw source terms, accepted Topics, folders, Project references, or accepted
notes. Explain why each result matched. Captured source facts are searchable
immediately; accepted knowledge enriches retrieval after promotion. Pending
candidates are excluded by default and appear only when the Owner explicitly
asks to include them.

Show each result's source quality, formal/candidate state, match reason, and
route back to its post case file or Review Packet. Never reintroduce Knowledge
Space as a parallel navigation or knowledge system.

## Completion check

A post is complete when its source is retained and the Owner's current review
decision is visible, evidenced, and has no hidden required next step. Do not
require a folder, learning note, Topic, Project, POC, draft, or local delivery
when the Owner intentionally declined it. Local-record synchronization is
reported separately from semantic review completion.
