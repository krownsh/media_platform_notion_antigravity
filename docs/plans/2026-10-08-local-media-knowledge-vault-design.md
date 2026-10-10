# Local Media Knowledge Vault Design

**Status:** Owner-approved design; initial provisional post case-file delivery is implemented. Later event mirroring, accepted rename/move, aggregate Topic/Project files, local-change scanning, and conflict resolution remain follow-up work.

**Decision date:** 2026-10-08 (Asia/Taipei)

## 1. Purpose

Every successfully persisted media post must have one durable, human-readable
local Markdown record.  The record is not merely an optional personal note. It
is the complete case file for that post: captured source material, the
post-scoped Owner/agent discussion, agent analysis and research, proposals,
decisions, Topic and Project relationships, POC outcomes, and local-delivery
history.

The online application remains the place to capture, review, decide, search,
and resume work.  The local Vault is the place to browse, retain, and manually
organize the finished working record.  The system must not create a second,
silently divergent note system.

This design applies to new records after the cutover.  Existing
`wiki/threads/...` records remain read-only legacy evidence until a per-record
migration candidate is explicitly accepted by the Owner.

## 2. Approved decisions

1. One persisted post has one continuous Markdown file, identified internally
   by its immutable `post_id`.
2. The human-readable path and title are more important than the ID for daily
   retrieval.  The ID is retained in the filename suffix and frontmatter for
   stable reconciliation.
3. The accepted primary folder determines the physical post path.  Topics are
   multiple links/indexes, never duplicate physical post files.
4. A new post is written promptly under `Posts/Inbox/` with a provisional
   filename.  Only an Owner-accepted semantic title and primary folder may
   rename or move it into a formal location.
5. Every post-scoped Owner/agent discussion is retained verbatim together with
   a structured conclusion.  General conversation not explicitly attached to
   the post review packet is not automatically copied into that post file.
6. Candidate and rejected work remains in the post case file.  Only accepted
   knowledge writes to Topic, Project, or POC indexes and aggregation files.
7. Complete source text, source URL, platform, and capture time are recorded
   locally.  Media is referenced by stable ID/path and described; binary media
   is not duplicated into Markdown by default.
8. System-owned state and append-only history are distinct from an Owner-owned
   free-notes region.  The system never overwrites free notes.
9. A manual local edit is a candidate for online mirroring and search.  It is
   never uploaded or treated as formal state until the Owner accepts it in the
   online UI.
10. Local delivery failures are visible, durable, and retryable.  They do not
    erase or block the source/review workflow, and they never masquerade as a
    completed local record.
11. No legacy note is bulk moved, bulk imported, or deleted.

## 3. Local root and human-facing hierarchy

The approved Vault root is:

```text
/Volumes/DevSSD/10_Projects/Personal/media_collection
```

It was initialized as an independent Obsidian Vault on 2026-10-08 by creating
its `.obsidian/` directory.  No notes or old data were copied into it.

The normal, human-facing structure is:

```text
Media Knowledge/
  Posts/
    Inbox/
    <accepted-primary-folder>/
  Topics/
    <accepted-topic-title>.md
  Projects/
    <accepted-project-title>.md
  _System/
    sync-manifest.json
```

`Posts/<accepted-primary-folder>/` is the principal browsing path.  Platform
and date are not top-level directories because they are poorer recall cues;
they remain frontmatter and searchable fields.  `_System/` is reserved for
technical reconciliation metadata and must not become a user-facing knowledge
area.

### 3.1 Post path and filename lifecycle

Provisional capture path:

```text
Media Knowledge/Posts/Inbox/YYYY-MM-DD｜暫定：<source-or-candidate-title>｜<post-id-8>.md
```

Formal accepted path:

```text
Media Knowledge/Posts/<primary-folder>/YYYY-MM-DD｜<accepted-semantic-title>｜<post-id-8>.md
```

An original source title may be used as a provisional title.  An agent-created
semantic title is always a candidate.  It cannot become the formal filename
until Owner acceptance.  Later folder/title changes are recorded as events and
performed by a safe rename/move, never by creating a duplicate copy.

## 4. Per-post Markdown contract

Each post file has four logical sections.  Stable delimiter markers make the
ownership boundary machine-checkable.

```md
---
schema_version: 1
note_kind: media-post-case-file
post_id: <uuid>
workflow_id: <uuid-or-null>
source_url: <original-url-or-null>
source_platform: <platform>
captured_at: <ISO-8601>
title_status: provisional | accepted
primary_folder: Inbox | <accepted-folder>
topics: []
local_record_state: pending | synchronized | local_change_pending | conflict | failed
---

# <semantic title>

<!-- BEGIN MEDIA CURRENT STATE -->
## 目前狀態
- 為何保留：
- 目前理解：
- 已確認決策：
- 下一步：
- 本機同步狀態：
<!-- END MEDIA CURRENT STATE -->

<!-- BEGIN MEDIA SOURCE SNAPSHOT -->
## 來源快照
<!-- complete source text, source facts, media references/descriptions -->
<!-- END MEDIA SOURCE SNAPSHOT -->

<!-- BEGIN MEDIA EVENT LOG -->
## 工作歷程
<!-- append-only event blocks; historic blocks are never regenerated -->
<!-- END MEDIA EVENT LOG -->

## 你的自由筆記
<!-- Owner-owned content; the system never rewrites it -->
```

The current-state section is a compact reading view.  It may be rebuilt only
from accepted state and synchronisation facts.  The source snapshot is written
from the persisted source revision.  The event log is append-only: a later
outcome appends a new event instead of changing the text of an older event.
The free-notes section belongs entirely to the Owner.

### 4.1 Event format

Every event has a stable `event_id`, a timestamp, actor/provenance, event
type, formal state, linked entities, complete post-scoped messages where
applicable, a concise conclusion, and a precise outcome.  A representative
discussion event is:

```md
### 2026-10-08 14:25｜討論｜等待確認
- event_id: <uuid>
- actor: owner + agent
- type: discussion
- status: proposed
- links: folder-candidate, topic-candidate

#### 你的原始回應
> ...

#### Agent 的完整回應
...

#### 本次結論
- ...

#### 後續影響
- 建立的候選：...
```

Capture, agent analysis, Owner decision, research, POC outcome, rename/move,
sync retry, and conflict resolution use the same traceable event model.  Agent
output must identify whether it is a source fact, a candidate, an accepted
record, a rejected proposal, or a limitation.

## 5. Topic and Project contract

The post case file is the only place that contains all candidates, rejected
ideas, and full discussion history.  A Topic file is a clean living knowledge
note built only from accepted, cited cross-source knowledge revisions.  A
Project file/index contains only accepted project references and their
rationale.  Both link back to the relevant post files using `post_id` and the
recorded relative path.

This preserves the approved Topic model: a post can have one primary and up to
two related Topics; Topic creation does not require a repository; and a
candidate project reference or POC cannot mutate a real project.  A rejected
Topic or Project suggestion stays visible in the post event history but never
pollutes a formal aggregate.

## 6. Ownership and synchronization boundary

There is one source of truth per concern, not two competing editable copies:

| Concern | Authoritative record | Local representation |
|---|---|---|
| Captured facts, review packets, proposals, acceptance, audit | Supabase | Cited source snapshot and immutable event entries |
| Human-readable post case file | Local Markdown after confirmed delivery | Last confirmed rendered snapshot and checksum in Supabase |
| Owner free notes | Local Markdown until Owner accepts a mirror candidate | Optional accepted online mirror for search/preview |
| Topic/Project formal knowledge | Accepted owner-guided records in Supabase | Generated/updated formal aggregate note |

The browser never receives filesystem access.  The existing local
`media-collection-server`, reached through the existing authenticated API
surface, is the only file bridge.  It validates paths beneath the configured
Vault root and returns relative paths only; it must never expose arbitrary
absolute filesystem reads or writes.

### 6.1 Delivery lifecycle

1. A persisted complete or partial source creates its post case-file manifest
   and initial Inbox note request.
2. The local server attempts an atomic write of the source snapshot and the
   capture event.
3. On success it records path, content checksum, written event sequence, and
   `synchronized` status.
4. On failure it records the error safely and sets `pending` or `failed`;
   the UI exposes one explicit retry action.
5. A later accepted proposal appends an event and refreshes the current-state
   section.  It does not rewrite historic event blocks.
6. A local scan compares the owner free-notes hash and system-block integrity.
   Changed free notes create a reviewable local-change candidate.  Changes to
   system-managed blocks create a conflict, never an automatic upload.

The semantic source/review workflow may reach its own completion while local
delivery is pending.  The UI separately reports whether the post has a
complete local record, so a failed disk write cannot silently close the work.
No additional paid service, public filesystem endpoint, or permanent PM2
process is required.

## 7. Online user experience

The existing Library, Inbox, Topics, Projects, search, analytics, and folder
navigation remain.  Knowledge Space is not reintroduced.

The post detail page gains a local-record card that always states the current
phase, who/what is waiting, why, and one next action:

- `待建立本機紀錄` — write the initial file;
- `待本機落盤` / `同步失敗` — show reason and `重試同步`;
- `已落盤` — show relative path, timestamp, checksum/version, and rendered
  last-confirmed preview;
- `本機變更待確認` — show a scoped diff and `接受本機修改` or keep local;
- `同步衝突` — show the affected managed block and require an explicit choice.

Library cards and search results show a small local-record state.  Search can
include an accepted mirror of Owner free notes, but must label the match reason
and never rank an unaccepted local change as formal knowledge.  A dedicated
Knowledge Space, opaque background sync, or a second navigation universe is
out of scope.

## 8. Data and API implementation plan

Implementation is additive and owner-scoped.  Exact SQL/RPC names are subject
to schema review, but the design requires the following domain capabilities:

- `owner_local_note_manifests`: one row per post/topic/project note; stable
  file ID, owner ID, entity identity, relative path, title/folder status,
  last successful checksum/event sequence, sync state, timestamps.
- `owner_local_note_events`: ordered append-only event payloads tied to a
  manifest, post/review packet/proposal where applicable, provenance, formal
  status, and immutable timestamps.
- `owner_local_note_change_candidates`: owner-visible free-note diffs and
  integrity conflicts with base checksum/version, candidate text or safe diff,
  decision state, and audit metadata.
- Owner-scoped RPC/API operations to create a manifest, enqueue/perform a
  delivery, retry a delivery, inspect a relative-path preview, scan a note,
  and accept/reject a local-change candidate.  Browser code has no direct
  Supabase write or filesystem write path.

All tables must include `created_at`, `updated_at`, `user_id` ownership and
RLS.  JSONB event payloads must document their schema.  APIs require the
existing Supabase JWT boundary, ownership checks, idempotency keys, optimistic
version checks, and append-only audit entries.

The legacy `vault_sync` hard-completion gate and `wiki/threads` writer are not
extended.  The replacement must separate `review completed` from `local record
complete`, then move callers behind an adapter.  Removing old workflow code,
old scripts, or legacy notes requires a later retirement manifest and explicit
Owner confirmation.

## 9. Delivery phases and acceptance gates

### Phase A — Contract and safe storage

Add the local-record contract, schema migration, RLS, manifest/event/change
candidate services, and contract tests.  No legacy files are touched.

**Gate:** owner-scoped, idempotent manifests and append-only events can be
created; a browser cannot directly write paths or note data.

### Phase B — Local writer and integrity checks

Implement path construction, safe title/path sanitisation, atomic writes,
system/free-section parsing, checksum persistence, retry states, and local
scan/conflict behaviour against the approved root.

**Gate:** a complete and a partial source each write one Inbox case file;
attempted path traversal, unmanaged-file collisions, malformed delimiters, and
atomic-write failures are safe and visible.

### Phase C — Owner-guided review integration

Append candidate, discussion, accept/reject, Topic, Project, research, POC,
and rename/move events from the owner-guided review domain.  Only accepted
facts update current state and Topic/Project aggregates.

**Gate:** a single post can be captured, reviewed, moved out of Inbox,
discussed across multiple turns, linked to multiple Topics, and recovered from
an interrupted delivery without duplicate events or files.

### Phase D — Frontend and search

Add the post-detail local-record card, card/search states, preview/diff
experience, retry action, and explicit one-next-action presentation.  Preserve
the restored legacy layout and navigation.

**Gate:** authenticated browser checks show the same state as APIs; no file
path outside the approved root is exposed; candidate local edits remain out of
default formal search.

### Phase E — Topic/Project notes and legacy candidates

Materialize accepted Topic/Project aggregate notes and add read-only,
per-record migration candidates for `wiki/threads`.  No bulk migration,
automatic import, or deletion occurs.

**Gate:** Topic aggregates cite accepted post records; rejecting a legacy
migration leaves both the legacy file and new Vault unchanged.

## 10. Verification requirements

- Unit tests: filename/path construction, sanitisation, Markdown rendering,
  event append semantics, free-notes preservation, checksums, diffs, and
  conflict states.
- Service and route tests: JWT ownership, RLS/RPC boundaries, idempotency,
  optimistic locking, retries, and audit records.
- Filesystem integration tests: temporary Vaults, atomic writes, malformed or
  symlinked paths, duplicate title collisions, failed writes, safe renames, and
  legacy-path isolation.
- Workflow tests: capture → Inbox note → candidate discussion → accepted
  title/folder → moved note → Topic aggregate; and the same flow with a local
  write failure and later retry.
- Frontend build/lint and authenticated browser checks: state text, one next
  action, preview, diff, retry, and legacy UI compatibility.
- Authorized live readback only after implementation: verify a controlled
  test post and its local relative path/checksum.  Never use a bulk backfill as
  the first production test.

## 11. Explicit non-goals

- No automatic migration, deletion, or rewrite of `wiki/threads` files.
- No duplicate media binary storage in Markdown by default.
- No direct Cloudflare/browser filesystem access.
- No automatic import of arbitrary local text into formal records or search.
- No repository-bound Topic requirement.
- No automatic POC execution or real-project modification.
- No new paid infrastructure or independent permanent worker.
