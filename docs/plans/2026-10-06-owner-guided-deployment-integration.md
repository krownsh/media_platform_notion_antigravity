# Owner-Guided Workflow Deployment Integration Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to
> implement this plan task-by-task.

**Goal:** Move the verified owner-guided capture → review → formal knowledge
workflow into the running environment without losing the user's existing
uncommitted work, source evidence, or ability to roll back.

**Architecture:** The rebuild branch is a tested code/migration set; the
currently running `main` checkout is a distinct, dirty operational checkout.
Integration is therefore a deliberate three-way reconciliation, not a force
update. Database changes are forward-only and are applied before only the
specified runtime processes are restarted. Post-deploy checks follow the same
user-visible sequence as the product: capture, owner review, acceptance, Topic
knowledge, and Library retrieval.

**Tech Stack:** Git, Node.js/Vite, PostgreSQL/Supabase migrations, PM2,
existing server and capture worker, owner-guided review APIs and React UI.

---

## Safety boundary

This plan intentionally does **not** authorize a deployment. It records the
required actions after the Owner explicitly authorizes integration and
identifies the approved target environment. Never reset, clean, force-push, or
check out over the running checkout. Never run PM2 detailed environment dumps;
they can disclose credentials.

Known state captured on 2026-10-06:

- the running server and capture worker use the original project checkout on
  `main`, not this rebuild worktree;
- the first inspection found `main` 12 commits behind the rebuild; recompute
  this immediately before integration because subsequent documentation commits
  intentionally change that count;
- the original checkout has 23 dirty entries owned by the user;
- exactly two dirty tracked files also changed in this rebuild:
  `server/services/captureFinalizationService.js` and
  `server/services/captureProcessingService.js`;
- all other dirty/untracked entries must be preserved as-is; and
- remote Supabase inventory, backup status, endpoint telemetry, and
  authenticated staging readback have not yet been supplied.

## Explicit approvals required before Task 1

Record all of the following in the deployment ticket or in this conversation:

1. The exact target: staging or production, including its Supabase project.
2. Authority to create a **new integration branch/worktree** from the current
   running checkout; this does not authorize rewriting `main`.
3. Authority to apply the reviewed forward migrations in that target database.
4. Authority to restart only `media-collection-server` and
   `media-collection-capture-worker` after preflight passes.
5. The agreed rollback owner and observation window.

If any item is absent, stop at the preceding read-only checkpoint and report
the missing decision. Do not infer it from approval of source code changes.

### Task 1: Freeze a recoverable integration baseline

**Files:**
- Read: original checkout `git status --short`, `git diff --name-only`, and
  `git diff -- server/services/captureFinalizationService.js
  server/services/captureProcessingService.js`
- Create: a new, Owner-named integration worktree/branch; never reuse this
  rebuild worktree or overwrite the running checkout
- Preserve: every existing dirty and untracked item in the original checkout

**Step 1: Record the exact preflight state without secrets.**

Run read-only Git status, branch, and divergence checks. Save only filenames,
commit IDs, and counts in the deployment record. Do not archive process
environments or configuration values.

Expected: the operator can identify the branch tip, all user-owned dirty
entries, and the intended deployment target.

**Step 2: Obtain a restorable copy of user-owned changes.**

With the Owner present, create a recoverable patch or a dedicated safety commit
on the new integration branch. Include untracked work only if its ownership and
retention are confirmed. Verify that the copy can be listed and inspected
before any merge work begins.

Expected: the original checkout remains unchanged and every local user edit has
one confirmed recovery location.

**Step 3: Create the integration branch from the actual running state.**

Use a new branch with a name such as `codex/owner-guided-integration-YYYYMMDD`
and a new worktree. Start it from the exact running commit plus its preserved
working-tree state; do not start from a guessed remote branch.

Expected: a separate workspace contains the baseline to integrate, while the
running checkout is untouched.

**Step 4: Commit the preservation evidence.**

Commit only the deployment-record metadata in the integration workspace.
Never commit secrets or a process-environment export.

### Task 2: Reconcile the code intentionally

**Files:**
- Merge source: `codex/media-workflow-rebuild`
- Manual reconciliation required:
  `server/services/captureFinalizationService.js`
  `server/services/captureProcessingService.js`
- Read first: `docs/plans/2026-10-06-capture-service-reconciliation-matrix.md`
- Verify: `server/routes/*`, `server/index.js`, `src/App.jsx`, migrations under
  `database/deployments/stage_x_owner_guided_*.sql`

**Step 1: Merge the reviewed rebuild commits into the integration branch.**

Apply commits through the newest deployment-readiness documentation commit.
Resolve no conflict by choosing an entire side blindly.

Expected: only the two known capture-service overlaps require semantic review;
new conflicts are a stop condition requiring a fresh inventory.

**Step 2: Reconcile the two capture services by behavior, not text.**

Preserve any user-specific capture handling from the running checkout while
enforcing the M1 boundary: successful capture writes a source revision and
capture state only; it must not enqueue automated analysis, Topic, note,
workflow, or outbox writes. Preserve retry/idempotency behavior and failure
recording. The reconciliation matrix names the exact allowed carryovers and
the `complete`/`partial` source-quality boundary; do not improvise a third
semantic variant during conflict resolution.

Expected: both old local fixes and the owner-guided capture-only contract are
represented in the merged implementation.

**Step 3: Run the regression gates before committing.**

Run:

```bash
npm run lint
node --test test/server/*.test.js test/script/*.test.js
npm run build
```

Expected: lint succeeds, all repository tests pass, and Vite produces a build.
Any changed or failing capture test is a stop condition; do not deploy a
partial merge.

**Step 4: Review and commit the integration.**

Review the merge diff with the Owner, specifically the two capture services,
new migrations, and removal manifest. Commit the integration branch; do not
force-update `main` or push without a separate Owner instruction.

### Task 3: Establish database recovery evidence

**Files:**
- Apply in order:
  `database/deployments/stage_x_owner_guided_capture_cutover.sql`
  `database/deployments/stage_x_owner_guided_review_domain.sql`
  `database/deployments/stage_x_owner_guided_first_review_vertical.sql`
  `database/deployments/stage_x_owner_guided_topics_projects_catalog.sql`
  `database/deployments/stage_x_owner_guided_search.sql`
- Read: `docs/architecture/owner-guided-workflow-evidence-ledger.md`
- Read: `docs/architecture/legacy-physical-retirement-manifest.md`

**Step 1: Inventory and back up before mutation.**

Export the target schema/object inventory and per-user row counts for every
table touched by these migrations and each protected table named in the
retirement manifest. Create and verify a restorable backup. Record backup
location/access procedure without embedding credentials.

Expected: an operator can restore source evidence, reviews, formal knowledge,
and search projection before any migration is attempted.

**Step 2: Apply migrations in a disposable or staging target first.**

Apply M1 through M5 in order and record migration IDs/checksums. Reapply each
only where it is designed to be idempotent; do not edit historical applied
migration files.

Expected: migrations complete without privilege, RLS, or dependency errors.

**Step 3: Perform authenticated database readback.**

Using two non-production test owners, prove:

- capture creates one raw source revision and no semantic formal write;
- review accepts an edited proposal only through the dedicated promotion path;
- an accepted optional post note may remain absent;
- one source can link to multiple independent Topics with citations;
- project references and POC proposals remain candidates until accepted;
- normal Library search returns raw/formal data, excludes candidates by
  default, explains match reasons, and prevents cross-owner reads.

Expected: row counts and API/UI responses match the owner-guided contract.

**Step 4: Document a forward rollback before production.**

Prepare reviewed forward migrations or feature-route disables that stop new
owner-guided writes while preserving all source, review, audit, Topic, and
search records. Do not plan table drops as rollback.

### Task 4: Switch only the approved runtime processes

**Files:**
- Runtime: `media-collection-server`, `media-collection-capture-worker`
- Read: PM2 status (names/status/path only)
- Verify endpoints: capture request, review focus packet, promotion, Library
  search, owner post detail, Topics, Projects

**Step 1: Put legacy semantic producers in an observable safe state.**

Before restart, identify every scheduler, cron, or PM2 worker that can call
legacy analysis/workflow/outbox services. Disable none without explicit Owner
approval. If an unapproved producer remains, leave it running and stop this
task rather than claiming the semantic boundary is protected.

**Step 2: Restart exactly the approved processes.**

Restart only the server and capture worker named in the approval after code and
database checks pass. Do not use a broad PM2 reload-all. Do not dump process
environment variables.

Expected: the two named processes return online from the approved integration
workspace/revision; unrelated processes remain unchanged.

**Step 3: Perform an authenticated end-to-end smoke test.**

In the user-facing interface, run this exact visible path:

1. Submit one safe test post URL and see capture progress/completion.
2. Open Inbox and see its current stage, meaning, and one next action.
3. Review the generated candidates; edit/defer/resume one as appropriate.
4. Accept a folder and at least one Topic only through the explicit acceptance
   control; leave the optional post-learning note empty once.
5. Open the Topic and verify cited aggregated knowledge is separate from the
   post's own learning note.
6. Search Library by remembered source wording and by accepted Topic wording;
   verify why each result matched and that pending candidates are hidden until
   explicitly requested.

Expected: no stage is implicit, no semantic draft becomes formal without an
owner action, and the source is retrievable through both paths.

**Step 4: Observe and decide.**

Monitor errors, capture queue failures, legacy producer writes, and endpoint
traffic for the agreed window. Only after the window and a fresh Owner decision
may the separate Batch B–E retirement procedure begin.

### Task 5: Stop conditions and recovery

**Files:**
- Read: integration commit, backup record, process revision/status, database
  migration record, `docs/architecture/legacy-physical-retirement-manifest.md`

**Step 1: Stop immediately if evidence is incomplete.**

Stop when backup restoration is unverified, an unreviewed conflict appears,
migrations fail, cross-owner access appears, candidate data is visible by
default, capture creates semantic writes automatically, or a process starts
from an unexpected revision.

**Step 2: Restore service behavior without deleting data.**

Use the prepared integration rollback/revision and route/feature disables.
Apply only reviewed forward database recovery migrations. Preserve raw source,
review, approval, audit, Topic, project, and search evidence for diagnosis.

**Step 3: Write the outcome into the evidence ledger.**

Record target, integration commit, migration IDs, backup verification,
process revisions, smoke-test result, observation-window result, and any
remaining legacy producer. Never state that B–E were retired unless their
separate gates have been met.
