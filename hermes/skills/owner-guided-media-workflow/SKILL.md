---
name: owner-guided-media-workflow
description: Guide capture, review, Topic knowledge, project references, Library retrieval, approved POCs, and local Obsidian post case files in this collection.
---

# Owner-Guided Media Collection Workflow

This is the primary conversational workflow for the project. Raw source
evidence and its provisional local record may be created automatically; every
semantic or external effect stays a visible candidate until the Owner
explicitly accepts it. The legacy `my-mediacrawl-skill` name is only a
compatibility entry to this same workflow.

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

### Nested long-form evidence is part of the source

After capturing a public post, inspect its captured body, card/link metadata,
and platform-specific structure for a public **nested long-form source**: for
example an X Article linked by an X post, a native article, a note, or another
public long-form document presented as the post's substantive content. A
teaser post that points to such a source is not by itself the complete
evidence bundle.

- For every discovered nested long-form source, recursively capture its
  canonical public representation before assessing the parent source as
  complete. Follow only nested long-form sources that the captured content
  presents as substantive source material; do not turn this into an unrelated
  outbound-web crawl. Detect canonical duplicates and cycles, retain one
  canonical revision, and record every parent-to-child relation.
- The child capture must retain its requested URL, final/canonical URL,
  platform/type, capture time, extraction method, parent source revision and
  link context, plus the retrieved body, media, comments where applicable, and
  an immutable child revision. Redirects, access limits, unsupported renderers,
  and a missing body are provenance facts, not silent success.
- Record the evidence-bundle result explicitly: `no_nested_longform_found`,
  `nested_longform_captured`, `nested_longform_partial`, or
  `nested_longform_failed`, including the canonical targets and the specific
  fields still missing. If later inspection discovers a nested long-form link,
  downgrade any earlier parent-only `完整來源` assessment and reopen source
  repair; never preserve "complete" merely because the teaser post was saved.

Recursive capture stops only when no further in-scope public nested long-form
source is discovered, a canonical duplicate/cycle is reached, or a failed
child has been recorded. A failure or partial child makes the **evidence
bundle** partial even if the parent post was captured cleanly.

Source quality is explicit and applies to the whole evidence bundle (the
parent source plus every required nested long-form source), not just the first
post fetched:

- **完整來源** — the parent and all required canonical nested long-form
  sources were captured with their provenance; prepare the visible Review
  Packet and its candidates.
- **部分擷取** — say precisely what is missing; offer either repair or the
  explicit Owner action **以目前來源建立候選**. Do not create semantic
  candidates first. This includes a captured teaser whose public nested
  article/body could not be retrieved.
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
Its initial snapshot contains the **complete readable evidence bundle**, not a
summary: the parent post's full text, each required nested long-form source's
full captured body under its canonical URL, media references/descriptions, and
source comments. Label the parent and every nested source so a reader can tell
which text came from which URL. A linked Article body must never be replaced by
its teaser, preview, or the agent's summary. Do **not** write JSON walls into
the Markdown file; raw structured evidence remains in Supabase. The case file
must identify itself as provisional and say that the next action is review.

Local delivery has its own state: pending, synchronized, failed, local change
pending, or conflict. A write failure is visible and retryable but never
rolls back a captured source, erases candidates, or falsely closes review.

## 2. Review automatically prepared candidates

For a complete source, prepare visible drafts only: at most one primary-folder
proposal, an optional post learning note, one primary Topic plus up to two
related Topics, Topic knowledge deltas, and relevant Project references. A
post learning note may be intentionally empty (`not_needed`).

### Required content review before classification

**Discuss the post with the Owner before asking for any folder, Topic, learning
note, Project, POC, or other classification decision.** A complete capture
means the source may enter review; it does not mean that the Owner is ready to
classify it.

The first review response must present an understandable **content review
brief**, clearly separating source facts from the agent's inference. It must
start with a compact **evidence map** for the evidence bundle: the parent
post's role, every discovered nested long-form target with its canonical URL
and capture status, what child text/media was actually retrieved, and the
specific evidence still missing. Make clear when a claim comes from the
teaser versus the canonical article; do not imply that article content was
read when only its link was captured.

The brief must then include:

- the captured text, author/context, media or comments that materially affect
  interpretation, and any important capture gap (including a failed or
  partial nested long-form capture);
- a neutral reconstruction of the post's main claim, method, or argument;
- the potentially useful idea, limitation, ambiguity, or question worth
  discussing; and
- a single invitation for the Owner to react, ask questions, correct the
  interpretation, or explicitly say that discussion can be skipped.

Do **not** make a folder or Topic selector the next action in this first
response. Do **not** infer a waiver from a request such as “處理最新一篇文章”.
Only after the Owner has substantively discussed the brief, corrected it, or
explicitly waived discussion may the agent present classification candidates
and request a decision. If the captured evidence is not sufficient for an
honest content brief, remain in **來源修復** instead of asking the Owner to
classify it.

For each candidate show:

- source evidence and why it was suggested;
- what acceptance would change;
- the clear choices: accept, edit then accept, reject, or defer.

### Required folder and Topic choice lists

When presenting a folder-assignment or Topic-assignment candidate, provide the
Owner with the **complete current choice list directly in that review**. Do
not show only a short list of alternatives, a guessed match, or an instruction
to search elsewhere.

- **Folders:** list Inbox and every currently selectable Owner folder, each
  with its readable name and stable selection identifier. Clearly mark the
  suggested choice, if there is one; do not preselect it.
- **Topics:** list every current Topic that can be linked, with its readable
  name, stable selection identifier, and formal/candidate state. Clearly mark
  any suggested primary or related Topics, if there are any. Also offer the
  explicit option to keep the post without a Topic; creating a new Topic still
  requires an explicit Owner-provided name and acceptance.
- If a choice list is too large for one response, present it in clearly
  numbered pages and give the Owner a direct page-selection action. The full
  list must remain available during the same review; it must not be hidden
  behind an unrelated Library search or a separate workflow.

The Owner can select any listed folder or Topic by name or stable identifier.
That selection is still a reviewed candidate decision, not an automatic
promotion.

No automatic process may accept, promote, rename, move, or otherwise turn a
candidate into **正式知識**. A direct folder selector is an explicit Owner
action and must use the same audited reviewed-promotion path; browser clients
must never write folders directly.

The accepted primary folder, if any, is the only authority for a formal
physical post path and accepted filename. Until then the case file stays in
Inbox with its provisional title. Moving or renaming is a safe single-file
operation recorded as an appended event, never a duplicate file.

### Vault naming and storage contract

The post case file has exactly one physical home. Use these paths beneath the
approved Vault root, sanitizing a title or folder segment for filesystem safety
while retaining `post_id-8` as the stable suffix:

```text
# before an Owner accepts both the folder and semantic title
Media Knowledge/Posts/Inbox/YYYY-MM-DD｜暫定：<source-title>｜<post-id-8>.md

# after the Owner accepts the primary folder and semantic title
Media Knowledge/Posts/<accepted-primary-folder>/YYYY-MM-DD｜<accepted-semantic-title>｜<post-id-8>.md
```

The capture date supplies `YYYY-MM-DD`; a source title may be used only for
the provisional filename. An agent-created title is a candidate until the
Owner accepts it. Topic names never create duplicate post files. Each Topic
has one independent, continuously appendable note at
`Media Knowledge/Topics/<accepted-topic-title>.md`; it contains `已接受知識`
and `Topic 討論歷程` sections and links every entry back using the stable post
id and relative post path. Project aggregate notes, when local delivery is
enabled, live at `Media Knowledge/Projects/<accepted-project-title>.md`.

## 3. Keep the three knowledge layers separate

1. **Post case file** — the complete per-post record: source snapshot,
   post-scoped Owner/agent discussion, analysis, candidates, accept/reject
   decisions, research, POC outcomes, and append-only history.
2. **Post learning note** — optional, post-specific learning. It may be
   absent and must never be fabricated just to complete the workflow.
3. **Topic knowledge** — an independent, cited, cross-source living record.
   Its **已接受知識** section is a clean Owner-accepted synthesis; its separate
   append-only **Topic 討論歷程** section preserves concise, material
   cross-source discussion and decisions. Neither section copies a whole post
   or its raw source body.

A Topic is independent of repositories, a post may connect to multiple Topics,
and Topic creation never requires a Project. Project/repository references are
only candidates; acceptance records why they may help and does not modify a
workspace.

Only accepted Topic knowledge updates the Topic's **已接受知識** section.
Material topic-level discussion may still be appended to that Topic's distinct
**Topic 討論歷程** section with an explicit candidate/accepted/rejected/deferred
state. Rejected or deferred ideas remain traceable in the post case file and,
when they were discussed at Topic scope, in that labelled history; they never
become formal knowledge or a search result as accepted knowledge.

### Discussion-to-file routing (do not mix the layers)

There is **no separate per-post Topic-discussion file or Project-discussion
file**. The one post case file is the complete, chronological record for this
source. Every candidate and Owner decision below is appended there as a
separate, labelled event; never merge it into raw source text or overwrite an
earlier event.

| Material | Where it is written | When |
| --- | --- | --- |
| Content review brief, including evidence map, neutral reconstruction, inference, limitation, and Owner discussion/waiver | Post case file → `內容審核` event | After source capture, before classification |
| Folder / post-learning-note candidate and decision | Post case file → labelled candidate/decision event | During candidate review |
| Topic-link candidate, Topic knowledge delta, the Owner's edits/accept/reject/defer decision for this source | Post case file → `Topic 知識` event | For every Topic review |
| Concise, material cross-source Topic discussion and its state, linked to source post IDs/case files | `Media Knowledge/Topics/<accepted-topic-title>.md` → append-only `Topic 討論歷程` | When a discussion changes, questions, or qualifies the Topic as a whole |
| Accepted cross-source Topic synthesis only, with citations back to post IDs/case files | `Media Knowledge/Topics/<accepted-topic-title>.md` → `已接受知識` | Only after explicit Owner acceptance and enabled aggregate delivery |
| Project-reference or new-project candidate, rationale, Owner edits/accept/reject/defer decision | Post case file → `專案／POC` event | For every Project review |
| Accepted Project reference only, with rationale and links back to the case file | `Media Knowledge/Projects/<accepted-project-title>.md` | Only after explicit Owner acceptance and enabled aggregate delivery |
| POC proposal, scope, evidence, stop condition, outcome | Post case file → `專案／POC` event | Before and after a separately authorized POC |

The Topic file is not a raw-chat transcript: its `Topic 討論歷程` keeps only a
concise, append-only record of material topic-level questions, conclusions,
state, date, and source links. It must not contain raw source bodies, copied
single-post analysis, or a POC's working log. The Project file remains an
accepted-reference summary and does not receive an ongoing discussion log
unless a later Owner-approved project workflow defines one. Conversely, a case
file remains the complete home for source-specific discussion and decision
trail. If Topic aggregate delivery is unavailable, the source-specific event
remains in the case file and the unavailable delivery state is reported; do
not create a shadow discussion file.

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

### Required case-file contents across the review

The local record is updated in this order:

1. **Capture:** write the complete evidence bundle to `來源快照` as specified
   above. This is raw source evidence, never a rewritten version.
2. **Content review:** append the agent's content review brief as a
   `candidate` event. It must distinguish source facts, the neutral summary,
   inferences, and limitations; it must link to the precise source URL(s).
3. **Owner decisions:** append every accept, edit, reject, defer, or explicit
   discussion waiver with its concise conclusion. A Topic knowledge delta is
   always recorded in this case file. When it materially changes or qualifies
   the Topic as a whole, append a concise, linked entry to that Topic note's
   `Topic 討論歷程`; update `已接受知識` only after explicit Owner acceptance.
4. **Rename/move:** after acceptance of both primary folder and semantic title,
   update the current-state block and move/rename this same file to its formal
   path. If either decision is absent, keep the original Inbox file; do not
   manufacture a formal path or a duplicate copy.

If source persistence, local delivery, or a later event mirror is unavailable,
report its separate delivery state plainly. Do not claim that the full source
or the agent's summary is in the Vault until the file write and readback have
been verified.

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
