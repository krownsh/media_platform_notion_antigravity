# Product Knowledge Space Convergence — Milestone & Acceptance Ledger

> **Status:** Active implementation charter — created 2026-09-18
>
> **Purpose:** Turn the existing `從 0 到 1 產品開發工作流` knowledge space from a set of cited, disconnected nodes into an extensible product-building path; make it discoverable in the frontend; then reconcile approved source-folder taxonomy into live collections without unreviewed data loss.
>
> **Authority:** Owner instructed work to begin on 2026-09-18, including the knowledge-space entry, extensible path, taxonomy live writeback, and removal of zero-post Hermes-created duplicate folders. Live mutations remain gated by the explicit manifest review described in M4.

## Non-negotiable rules

1. A source post has exactly one primary collection. Knowledge-space membership never copies or moves a source by itself.
2. Every visible factual node keeps at least one source citation and its evidence status. Missing coverage is displayed as a gap, never fabricated as a completed stage.
3. The product path is data-driven: stages, gates, relationships, and node-to-stage assignments cannot be hard-coded to the initial seven stages.
4. New folders, renames, post reassignment, and empty-folder removal are separate stateful operations. They require an owner-readable manifest, ownership/cardinality checks, SSD backup, and a final explicit confirmation before live writeback.
5. No physical removal is included in code/deployment commits. The live cleanup candidate set is limited to verified zero-post, Hermes-created duplicate folders and is frozen in the manifest before any stateful action.
6. Docker contracts prove isolated behavior only. Production DB, deployed API, and authenticated browser behavior each require separate evidence.

## Product-path model

The initial path is a default traversal, not a schema limit:

```text
Market signal & problem
  → user / demand / distribution hypothesis
  → feasibility, platform eligibility & safety preflight
  → product contract, UX & implementation slices
  → engineering quality, security & interaction verification
  → release readiness, deployment & human publish decision
  → post-release signal review ───────────────────────────────┘
```

Each stage has: objective, required inputs, expected artifacts, decision/safety gates, coverage state, linked cited nodes, and one-or-more outbound transitions. The graph supports additional stages, branch paths, and feedback loops without a further schema migration.

## Acceptance ledger

| ID | Milestone | Original pass condition | Required artifacts / evidence | Boundary | Status | Next gap |
|---|---|---|---|---|---|---|
| M0 | Baseline and scope freeze | Existing state, owner decisions, and no-mutation boundary are recorded before changes | This file; prior Pilot ledger; live readback: one space, 4 scopes, 6 nodes, 9 citations; current folder scope and counts | Documentation + read-only live evidence | **Pass** | Commit this charter alone before implementation |
| M1 | Extensible product-path model | Product stages, gate definitions, transitions, and node links are data-driven; a post-release feedback edge is representable | `stage_w4_knowledge_space_path.sql`; `knowledge_space_path_migration.test.js`; `knowledge_space_service.test.js`; Docker result: 3 passed, 0 failed | Isolated Docker contract | **Partial** | Live additive-schema approval, apply, and readback are pending; no live tables changed |
| M2 | Knowledge-space frontend entry | An authenticated user can discover available spaces without knowing an ID, then enter a path reader from desktop and mobile navigation | `listKnowledgeSpaces`; `/api/knowledge-spaces`; `/knowledge-spaces`; desktop/mobile navigation; Docker contracts: 8 passed, 0 failed; clean-container `vite build`: passed (2.16s) | Isolated Docker contract + build | **Partial** | Deployed API and authenticated browser verification are pending; no live data/schema changed |
| M3 | Path reader as one connected journey | Reader renders ordered stages, gate cards, source-backed nodes, feedback edge, and honest evidence gaps; it does not render a disconnected node list | `KnowledgeSpaceMap`; stage journey contract; `stage_w4_knowledge_space_path_seed.sql`; 6 exact node IDs; 7-stage graph with feedback; Docker contracts: 5 passed, 0 failed; clean-container Vite build: passed (2.11s) | Isolated Docker contract + build | **Partial** | Live schema + seed approval, deployment, API readback, and authenticated browser verification are pending |
| M4 | Taxonomy reconciliation preview | Every proposed rename, post reassignment, and zero-post cleanup candidate is frozen and reviewable before any live mutation | `docs/previews/2026-09-18-live-taxonomy-manifest.json`; 2026-09-18 live read: 430 posts / 333 assigned / 97 Inbox / 0 dangling; 0 renames; 0 reassignment; 33 exact zero-post Hermes candidates; live fingerprint `a3175a2e59ee172a75344865c7be9c41`; artifact SHA-256 `249534906f932bf8abe2699edd7dea87a895d15f49119d6c55d96531d494cc93` | Read-only live DB export; no rename/reassignment/removal | **Partial** | Owner must approve the frozen 33-candidate cleanup scope; no rename or reassignment is authorized |
| M5 | Owner-approved live taxonomy writeback | Only manifest-approved collection changes apply; unrelated records remain untouched; before/after cardinality and ownership checks pass | Backup under `/Volumes/DevSSD/hermes/`; approved manifest fingerprint; transaction logs; before/after queries; conflict/no-op report | Authorized live DB mutation | Blocked by M4 Owner approval | Explain final scope in plain language and obtain final confirmation |
| M6 | Zero-post Hermes-folder cleanup | Only confirmed zero-post, Hermes-created duplicate candidates are removed from active live collection state; every candidate is backed up and post count rechecked inside the write boundary | M4 candidate manifest; backup; recheck result; per-candidate outcome; no collection with posts is touched | Authorized live DB mutation | Blocked by M4 Owner approval | Owner approves frozen candidate list and cleanup method |
| M7 | Deployment and end-to-end verification | Deployed frontend exposes the entry and path; authenticated owner sees the correct live content; folder results match M5/M6 evidence | Docker output; migration readback; deployed API response; authenticated browser screenshots/interaction; updated ledger | Runtime + production UI | Pending | Cloudflare deployment and browser verification after merge/push |

## Execution order and stop conditions

1. **M0 — Commit this charter.** No data mutation.
2. **M1 — Add the path graph model test-first.** Stop if the migration/API model would force a hard-coded linear seven-stage limit.
3. **M2–M3 — Build the entry and connected reader test-first.** Stop if an unauthenticated or cross-owner list/read path is introduced.
4. **M4 — Produce a read-only taxonomy manifest.** Stop if a source lacks enough evidence for a target: leave it Inbox/unresolved; do not infer a destination.
5. **M5–M6 — Live writeback gate.** Before any state change, show the exact scope in human language: number of collection renames, number of posts by source→target pair, and every zero-post candidate. Take the SSD backup, recheck counts, then require the Owner's explicit final confirmation.
6. **M7 — Deploy and verify.** Do not call the milestone complete based on unit tests, a static route, or a past summary. Record actual Docker, live DB, deployed API, and authenticated browser outputs.

## Current factual baseline

- Live space: `006ae3e5-a6e7-4334-b6fc-befd5c80dc9b`, `從 0 到 1 產品開發工作流`.
- Live space state at M0: 4 scoped folders, 6 published nodes, 9 citations.
- Current scoped folders: `agent工具` (235 posts), `工程師開發優化` (20), `副業` (9), `好用套件` (6).
- The source taxonomy artifact defines 20 proposed names, but is not yet a live folder-name or post-assignment change.
- Existing frontend only has `/knowledge-spaces/:spaceId`; it has no list route or desktop/mobile navigation entry.
- Existing citations support portions of demand, eligibility/security, implementation, engineering verification, and AI-role boundaries. They do not yet provide adequate evidence for a full post-release feedback stage; M3 must label this as a coverage gap until sourced.

## Explicit exclusions

- No automatic publication.
- No automatic new taxonomy categories.
- No fabricated evidence or silent reassignment for uncertain posts.
- No claim that the entire system is complete until M7 has criterion-level evidence.
