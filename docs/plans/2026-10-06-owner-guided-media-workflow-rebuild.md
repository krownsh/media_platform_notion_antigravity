# Owner-Guided Media Workflow Rebuild Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** Replace the legacy, coupled media workflow with an owner-guided system that reliably captures sources, proposes organization and knowledge updates, promotes only accepted decisions, stays searchable, and can be resumed from either the web UI or an agent conversation.

**Architecture:** Supabase is the only source of truth. Capture persists immutable source facts; an additive review domain stores proposals, approvals, checkpoints, post learning notes, topic knowledge revisions, project-reference candidates, and audit history. The frontend and agent use the same review APIs and `next_action`; old workflows are first frozen and hidden, then removed only after inventory, migration, and live verification.

**Tech Stack:** React 19, Redux Toolkit/Saga, Express 5, Supabase/PostgreSQL/RLS/RPC, Puppeteer crawlers, Node test runner, Docker-based integration checks, authenticated browser acceptance.

---

## Delivery rules

- Each milestone has a bounded, reversible scope. Do not start the next milestone until its required evidence exists.
- Tests prove only their stated tier: unit/static, isolated integration, authenticated browser, and authorized live readback are recorded separately.
- No semantic candidate becomes an official folder, note, topic, project reference, or POC without an explicit owner acceptance recorded in the database.
- Existing user changes on `main` are out of scope for this worktree. Do not overwrite or stage them.
- Legacy data is read-only historical evidence until a per-record migration proposal is accepted. Physical removal requires a separate backup, manifest, and owner confirmation.

## Milestone 0 — Baseline and retirement inventory

**Goal:** Establish current source/runtime/schema facts and a machine-reviewable keep/migrate/retire/delete-later inventory before changing behavior.

**Files:**
- Create: `docs/architecture/owner-guided-workflow-contract.md`
- Create: `docs/architecture/legacy-retirement-inventory.md`
- Create: `test/script/owner_guided_workflow_contract.test.js`
- Modify: `docs/README.md`

**Steps:**

1. Write a failing contract test that asserts the core invariants: capture is source-only; semantic changes are proposal-first; formal decisions are accepted-only; topics are not repository-bound; and legacy knowledge-space routes are absent from the target navigation.
2. Run the test and record its initial failure.
3. Document the authoritative target state, role boundaries, user-visible statuses, evidence tiers, and old-to-new migration mapping.
4. Add the documentation index entry and minimal code-independent contract fixtures.
5. Run the contract test, relevant current capture tests, and `npm run build`; record exact output in the milestone ledger.
6. Commit only M0 documentation and tests.

**Gate:** A reviewer can identify the source of truth, every official write gate, legacy components, and the evidence needed to delete each legacy component.

## Milestone 1 — Capture-only persistence contract

**Goal:** Make source intake reliable and independent of every semantic or legacy workflow.

**Files:**
- Modify: `server/services/captureProcessingService.js`
- Modify: `server/services/captureFinalizationService.js`
- Modify: `server/services/captureRequestService.js`
- Create: `database/deployments/stage_x_owner_guided_capture_cutover.sql`
- Modify: `server/workers/captureWorker.js`
- Test: `test/server/capture_processing.test.js`
- Test: `test/script/source_finalization_contract.test.js`
- Create: `test/server/owner_guided_capture_contract.test.js`

**Steps:**

1. Write tests for complete, partial, failed, duplicate, retry, and idempotent capture paths; assert no semantic workflow/outbox/Topic write occurs.
2. Run failing tests.
3. Add a capture revision/quality representation and transactional finalization behavior that persists only source facts and schedules a review-packet projection.
4. Add migration/RLS/RPC guards that prevent the legacy automatic outbox/workflow chain for new captures while preserving historical rows as read-only.
5. Implement the minimal worker changes; search-index projection failures remain non-fatal.
6. Run focused tests, Docker integration, and authenticated browser capture checks.
7. Commit M1 only after the contract and evidence ledger are green.

**Gate:** New capture creates a durable source record with `complete` or `partial` quality, or records a failed capture request with no source revision; it never creates a formal semantic decision.

## Milestone 2 — Shared proposals, approvals, and review checkpoints

**Goal:** Create the one state machine used by both the agent and web UI.

**Files:**
- Create: `database/deployments/stage_x_owner_guided_review_domain.sql`
- Create: `server/services/reviewPacketService.js`
- Create: `server/services/proposalService.js`
- Create: `server/routes/reviewRoutes.js`
- Modify: `server/index.js`
- Create: `test/server/review_packet_service.test.js`
- Create: `test/server/review_routes.test.js`

**Steps:**

1. Write tests for proposal lifecycle (`pending`, `proposed`, `accepted`, `rejected`, `superseded`), ownership, optimistic locking, idempotency, and audit events.
2. Run the tests to verify absence of the API/domain.
3. Add additive tables for review packets, proposals, approvals, checkpoints, and audit events. Include `created_at`/`updated_at`, user ownership, RLS, and JSONB comments.
4. Implement API routes for list/read packet, defer, accept, reject, and edit-and-accept; expose one deterministic `next_action`.
5. Run unit, isolated Supabase/Docker, and JWT-scope tests.
6. Commit M2 only after no API allows an unapproved proposal to mutate formal records.

**Gate:** Frontend and agent can inspect and change exactly the same packet/checkpoint state without duplicate or lost approvals.

## Milestone 3 — First complete review vertical slice

**Goal:** Deliver the user-visible path: capture → folder proposal → optional post learning note → topic links/Topic delta → clear next step.

**Files:**
- Create: `server/services/reviewProposalService.js` (the bounded folder, post-note, and Topic candidate generators share one idempotent packet preparation boundary)
- Create: `server/services/reviewPromotionService.js` (the only application entry point for M3 formal promotions)
- Modify: `server/services/reviewPacketService.js`
- Modify: `server/routes/reviewRoutes.js`
- Create: `src/api/reviewApi.js`
- Create: `src/features/reviewSlice.js`
- Modify: `src/store/rootReducer.js`
- Modify: `src/store/rootSaga.js`
- Modify: `src/pages/HomePage.jsx`
- Create: `src/components/ReviewFocusPanel.jsx`
- Create: `test/server/owner_guided_review_flow.test.js`
- Create: `test/script/review_focus_ui_contract.test.js`

**Steps:**

1. Write failing flow tests for exact one primary folder, optional/`not_needed` post note, one primary plus up to two related topics, source citation, and owner-only promotion.
2. Implement proposal generators that only create drafts; no model output writes official fields directly.
3. Implement promotion handlers and revision-safe Topic deltas.
4. Add Focus Mode UI with current step, why it matters, proposed action, defer, and resume semantics.
5. Verify the same packet can be accepted in API and reflected in UI without overwriting concurrent changes.
6. Run focused tests, Vite build, authenticated browser path, and commit M3.

**Gate:** A user can finish one source with no hidden state and resume after interruption from the same next action.

## Milestone 4 — Topics and Project Catalog

**Goal:** Make Topics independent living knowledge notes and Projects an owner-approved reference catalog.

**Files:**
- Create: `database/deployments/stage_x_topics_projects_catalog.sql`
- Create: `server/services/topicKnowledgeService.js`
- Create: `server/services/projectCatalogService.js`
- Create: `server/services/projectReferenceProposalService.js`
- Create: `server/routes/topicRoutes.js`
- Create: `server/routes/projectCatalogRoutes.js`
- Create: `src/pages/TopicsPage.jsx` (replace legacy behavior)
- Create: `src/pages/ProjectsPage.jsx`
- Create: `src/components/TopicDetailPanel.jsx`
- Test: `test/server/topic_knowledge_service.test.js`
- Test: `test/server/project_catalog_service.test.js`

**Steps:**

1. Write tests for Topic revisions, post citations, primary/related limits, proposal-first updates, Catalog ownership, and POC explicit approval.
2. Create additive schema/RLS/API; never require a GitHub target to create a Topic.
3. Implement Topic knowledge revision creation from accepted deltas only.
4. Implement owner-approved Project Catalog and candidate references for local, remote, and non-code projects.
5. Represent POC as an approved, isolated action proposal; it must never modify a real project without a separate execution approval.
6. Run tests/browser checks and commit M4.

**Gate:** A Topic can accumulate cited knowledge across sources and surface candidate project applications without any automatic project mutation.

## Milestone 5 — Library and hybrid search

**Goal:** Make every captured source easy to retrieve by exact terms, contextual memory, formal knowledge, or project relationship.

**Files:**
- Create: `database/deployments/stage_x_owner_guided_search.sql`
- Modify: `server/services/postSearchService.js`
- Modify: `server/routes/searchRoutes.js`
- Modify: `src/pages/SearchPage.jsx`
- Create: `src/components/SearchResultReason.jsx`
- Create: `test/server/owner_guided_search.test.js`
- Create: `test/script/search_ui_contract.test.js`

**Steps:**

1. Write tests for raw-source search, accepted note/topic/project search, provenance/reason labels, owner isolation, and candidate exclusion by default.
2. Add full-text indexes and a pluggable semantic-search projection. Do not require embeddings for the first usable full-text release.
3. Include a clear candidate toggle and source-quality/status filters.
4. Update all post/topic/project promotions to index asynchronously without making formal writes fail.
5. Run test, build, browser, and live-safe readback evidence; commit M5.

**Gate:** A user can find a source from raw text, a remembered idea, Topic, or project context and understand why it was returned.

## Milestone 6 — Legacy inventory, progressive migration, and UI retirement

**Goal:** Keep historical sources searchable while moving only owner-accepted data into the new model.

**Files:**
- Create: `server/services/legacyMigrationService.js`
- Create: `server/scripts/diagnostics/export_legacy_inventory.js`
- Create: `server/scripts/diagnostics/generate_legacy_review_packets.js`
- Modify: `src/App.jsx`
- Modify: `src/components/Layout.jsx`
- Modify: `docs/README.md`
- Create: `test/server/legacy_migration_service.test.js`
- Create: `test/script/legacy_route_retirement_contract.test.js`

**Steps:**

1. Export a read-only inventory of legacy tables/routes/UI and references.
2. Add only read-only migration candidates; never bulk-promote old folder, tag, or Topic assignments.
3. Make historical raw sources searchable and mark their old values as legacy evidence.
4. Replace navigation with Inbox, Library, Topics, Projects and remove legacy entry points from normal UI.
5. Run migration dry-run, browser checks, and commit M6.

**Gate:** New UI has no dependency on Knowledge Spaces or legacy workflows; old sources remain findable and are not silently rewritten.

## Milestone 7 — Verified physical retirement

**Goal:** Remove obsolete code, routes, jobs, tables, and UI after the new flow is proven in production-like and authorized live conditions.

**Files:**
- Create: `docs/retirement/owner-guided-retirement-manifest.md`
- Create: `database/deployments/stage_x_legacy_retirement.sql`
- Modify/Delete: only items explicitly enumerated in the approved manifest
- Create: `test/script/legacy_absence_contract.test.js`

**Steps:**

1. Produce an exact dependency/readback manifest and an SSD/database backup with checksums.
2. Require explicit owner confirmation of exact tables/routes/Cron jobs to remove.
3. Delete in small, independently verified batches; run foreign-key/RLS/readback checks after each batch.
4. Remove legacy tests/docs and prove their routes/tables/jobs no longer exist.
5. Run the full suite, authenticated browser smoke flow, deployment verification, and final live readback.
6. Commit the final retirement only after all evidence is attached to the ledger.

**Gate:** The deployed system exposes only Inbox, Library, Topics, Projects and the owner-guided review model; no legacy process can write new data.

## Acceptance ledger requirements

For every milestone, create a ledger row with: requirement, source files, tests/commands, actual output, evidence tier, known limits, rollback strategy, and explicit next gate. A prior green test is never reused as proof after the relevant code/schema changes.
