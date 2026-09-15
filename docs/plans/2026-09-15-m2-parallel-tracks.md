# M2 Parallel Knowledge and Project Tracks Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Give every source two independent, user-visible lifecycle tracks: knowledge curation and project application.

**Architecture:** Persist a bounded `context.parallel_tracks` object inside the existing `collection_post_workflows.context` JSONB, so no production schema or live-data migration is required. A pure server service owns normalization and transitions; `/api/posts` projects the normalized tracks; shared frontend presentation renders them without using the technical outbox state.

**Tech Stack:** Node.js ESM, Express, Supabase JSONB workflow context, React, node:test, Docker `node:20-alpine`.

---

### Task 1: Define and test the pure M2 track contract

**Objective:** Establish the only valid statuses and safe defaults for the two tracks.

**Files:**
- Create: `server/services/parallelTrackService.js`
- Create: `test/script/parallel_track_contract.test.js`

**Step 1: Write failing test**

Test that a workflow with no `context.parallel_tracks` produces:

```js
{
  knowledge: { status: 'pending', reason: '等待知識整理', updated_at: null },
  project_application: { status: 'not_applicable', reason: '尚未連結專案應用', updated_at: null }
}
```

Test that only `pending`, `processing`, `needs_review`, `completed`, `not_applicable`, and `failed` survive normalization; unknown values fall back to the default for that track.

**Step 2: Verify RED**

Run: `node --test test/script/parallel_track_contract.test.js`

Expected: FAIL because the service does not exist.

**Step 3: Write minimal implementation**

Export `TRACK_STATUSES`, `normalizeParallelTracks(context)`, and `withParallelTrack(context, track, patch, now)`.

Rules:
- Never read or infer technical Outbox status.
- Track keys are only `knowledge` and `project_application`.
- Preserve unrelated context keys.
- Reject unknown track keys and invalid status patches.

**Step 4: Verify GREEN**

Run: `node --test test/script/parallel_track_contract.test.js`

Expected: PASS.

### Task 2: Project the normalized tracks in the existing posts API

**Objective:** Return the two tracks to the existing authenticated post UI without breaking pre-M2 rows.

**Files:**
- Modify: `server/index.js` post formatter around `/api/posts`
- Modify: `test/script/workflow_ui_contract.test.js`

**Step 1: Write failing test**

Assert that the server post formatter imports/uses the shared normalizer and emits `parallelTracks`; assert the UI receives and uses that field rather than `outbox.status`.

**Step 2: Verify RED**

Run: `node --test test/script/workflow_ui_contract.test.js`

Expected: FAIL because `parallelTracks` is absent.

**Step 3: Write minimal implementation**

In `/api/posts`, derive `parallelTracks` from `workflow.context`; no write occurs in this API.

**Step 4: Verify GREEN**

Run: `node --test test/script/workflow_ui_contract.test.js`

Expected: PASS.

### Task 3: Render both states in cards and detail

**Objective:** Let the owner see both independent tracks on every post without conflating them with workflow status.

**Files:**
- Modify: `src/utils/workflowPresentation.js`
- Modify: `src/components/PostCard.jsx`
- Modify: `src/components/PostDetailView.jsx`
- Modify: `test/script/workflow_ui_contract.test.js`

**Step 1: Write failing test**

Assert card/detail import `parallelTrackPresentation`, render separate labels `知識收藏` and `專案應用`, and use `post.parallelTracks`.

**Step 2: Verify RED**

Run: `node --test test/script/workflow_ui_contract.test.js`

Expected: FAIL.

**Step 3: Write minimal implementation**

Map statuses to clear Traditional-Chinese labels. `failed` and `needs_review` must show the saved reason where available. Do not create clickable automation or alter topic decisions.

**Step 4: Verify GREEN**

Run: `node --test test/script/workflow_ui_contract.test.js`

Expected: PASS.

### Task 4: Add controlled workflow-context updates for preprocess

**Objective:** Allow the existing preprocess path to set either track independently, preserving the other one.

**Files:**
- Modify: `server/services/autonomyPolicyService.js` only if it owns normalize input
- Modify: `server/services/preprocessWorkflowService.js` (or actual workflow persist service after discovery)
- Modify: `test/script/post_workflow_contract.test.js`

**Step 1: Write failing test**

A preprocess result that changes `knowledge` to `needs_review` must preserve an existing `project_application: completed`; an invalid track status must be rejected before persistence.

**Step 2: Verify RED**

Run the targeted test and observe expected failure.

**Step 3: Write minimal implementation**

Use `withParallelTrack`; no automatic topic creation, no project source modification, no action authorization changes.

**Step 4: Verify GREEN**

Run the targeted test.

### Task 5: Verify and commit M2

**Objective:** Prove M2 against repository contracts in an isolated container.

**Files:**
- Modify: `docs/media_knowledge_workflow_milestones_2026-09-15.md` only after all M2 acceptance tests pass, updating M2 from unmarked to complete with evidence.

**Verification:**

```bash
node --test test/script/parallel_track_contract.test.js test/script/workflow_ui_contract.test.js test/script/post_workflow_contract.test.js
docker run --rm -v "$PWD:/workspace:ro" -w /workspace node:20-alpine node --test test/script/parallel_track_contract.test.js test/script/workflow_ui_contract.test.js test/script/post_workflow_contract.test.js
npx eslint server/services/parallelTrackService.js server/index.js src/utils/workflowPresentation.js src/components/PostCard.jsx src/components/PostDetailView.jsx
```

Then run the existing M0.1–M5 regression selection. Commit only touched files to `agent-dev`; do not push or merge without Owner authorization.
