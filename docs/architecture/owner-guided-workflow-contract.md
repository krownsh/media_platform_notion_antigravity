# Owner-Guided Media Workflow Contract

## Purpose

The product is a searchable media library and guided review workflow. It captures a source, proposes organization and learning work, and promotes only decisions accepted by the Owner. It is not an autonomous second-brain, a mandatory Vault writer, or a repository-bound topic manager.

## Authoritative state

Supabase is the only authoritative store for source facts, review state, formal knowledge, project references, and audit history. The web application and agent conversation use the same APIs and observe the same `next_action`. Vault export, search documents, notifications, and generated drafts are projections; their failure must not roll back an accepted source decision.

## Source intake contract

Capture persists source facts only: original URL or upload identity, platform, extracted body, media, comments, capture metadata, and a source revision. It never writes a formal folder, post learning note, Topic update, project reference, POC, or Vault entry.

Persisted source quality is exactly one of:

- `complete`: enough source material exists to prepare a review packet.
- `partial`: some material was preserved but review must first disclose what is missing.

If no reliable source material is persisted, the result is a **failed capture request**, not a third source quality and not a source revision. It remains a retry/failure record and cannot begin semantic review. For a `complete` source, the system automatically prepares an owner-visible Review Packet and candidate proposals. This projection never accepts or promotes formal knowledge; the Owner's next action is review, not candidate creation. A `partial` source stops at the source-repair step until recapture succeeds or the Owner explicitly accepts use of its retained material. A later successful recapture creates a new revision and proposes, rather than silently overwrites, downstream updates.

## Proposal and promotion contract

Every semantic change is proposal-first and accepted-only. Proposal lifecycle values are `pending`, `proposed`, `accepted`, `rejected`, and `superseded`. A proposal carries its source revision, rationale, model/provenance, owner scope, version, and audit events.

Only an accepted proposal may create or update formal records. Accept, reject, defer, and edit-and-accept operations are user-scoped, idempotent, optimistic-locked, and auditable. Defer preserves the packet and its deterministic `next_action`; it is neither rejection nor completion.

## Formal organization contract

Each post has zero or one accepted primary folder. A missing accepted folder means Inbox, not a hidden or fabricated category. Folder taxonomy is versioned and Owner-governed; no tool name, company, transient trend, legacy collection, tag, or auto-topic is a substitute for an accepted primary folder.

The Library may expose a direct folder selector because it is an explicit Owner action, not an automatic classification. When an open folder candidate exists, that selector must use the same reviewed promotion path (including an edited acceptance when the Owner chooses a different folder). When no candidate exists, the selector is a manual Owner override and must be handled by an owner-scoped server endpoint with an append-only activity record. Browser clients must not write `collection_posts.collection_id` or create folders directly.

Each post may have one primary Topic and up to two related Topics. Topic links are accepted separately from the folder. A Topic is an independent living knowledge note, not a repository requirement or an alias for a folder.

Each post may have an optional post learning note. A note may be accepted as `recorded`, explicitly accepted as `not_needed`, or remain `needs_discussion`; an empty note must never be represented as a completed learning result.

Topic knowledge revisions contain cited, cross-source synthesis only. They record claims, supporting/contrasting sources, limitations, open questions, and project-reference candidates. They do not copy a full source or treat a candidate as formal knowledge.

## Project and POC contract

Projects live in an Owner-approved Project Catalog and may be local repositories, remote repositories, or non-code initiatives. Topic creation never requires a repository target. A source or Topic may propose a project reference; acceptance records why it might help, not that it will be adopted.

A POC requires a separate explicit Owner approval. It runs only in an isolated workspace and produces an evidence-backed outcome (`adopt`, `defer`, or `reject`); it must not modify a real project as a side effect of proposal acceptance.

## Review and accessibility contract

A Review Packet is the resumable unit for a source. It contains source-quality information, a folder proposal, post-note proposal, Topic links and Topic deltas, project-reference candidates, and the deterministic next action.

The default user experience is Focus Mode: present one main decision, why it matters, the recommendation, alternatives, what acceptance changes, what defer means, progress completed, and the next action. Full packet and batch review are optional. Every page and agent response must make the current phase, waiting party, and next action explicit; no user is expected to remember hidden workflow stages.

The primary conversational entry is
`hermes/skills/owner-guided-media-workflow/SKILL.md`. It applies the same
source, packet, candidate, and formal-state boundaries as the web app. Its
response contract is current phase, why it is current, and one next action.
The older MediaCrawl skill and webhook examples are legacy-runtime
compatibility artifacts only; they are not normal user entry points and remain
subject to the separate physical-retirement gate.

## Search contract

Search indexes raw captured sources immediately. Formal folder, accepted learning notes, accepted Topic knowledge, accepted project references, and user notes enrich retrieval after promotion. Candidate content is excluded from default search ranking and shown only through an explicit candidate toggle. Results show their match reason, source-quality state, formal/candidate state, and links back to the source.

## Evidence and release contract

No milestone is complete without the evidence stated in its ledger. Static tests, isolated integration/Docker tests, authenticated browser checks, and authorized live readback are distinct evidence tiers. New features must be additive until their migration and rollback conditions are verified.
