# K1.1 受控歸檔與 Topic 隔離 Implementation Plan

> **For Hermes:** Use `software-development/subagent-driven-development` task-by-task after Owner approval. Do not process a real workflow or write Supabase during this plan.

**Goal:** 讓 preprocess 的資料夾歸檔只可能發生在 Owner 核准的 20 個同 owner 收藏資料夾；保留既有人工歸檔、模糊項留 Inbox，並確保資料夾不會建立或連動 Topic。

**Architecture:** 將 K1 的已核准 ID 清單編譯為 server-side、fail-closed runtime policy。`preprocess-workflow.js` 將該 policy 唯一地傳給 `persistFolderDecision`；service 在任何 lookup/update 前檢查既有歸檔、allowlist、owner，並用 `collection_id IS NULL` 作條件更新，避免覆蓋並行人工動作。Topic source-match 與資料夾路徑維持獨立，且先保留既有 user accepted/rejected 決定。

**Tech Stack:** Node.js ESM、Supabase client（unit-test fake client）、Node built-in test runner、`node:20-alpine` Docker（`--network none`）。

**Authority / frozen input:**

- Owner K1 decision: `/Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/owner-decision-k1.md`
- Approved taxonomy: `folder-whitelist.json`, SHA-256 `79b3f521ca0e8fae2b639ed20a4a2b25ad94c2b5dadf7136f6a762363eefa7b0`
- 20 approved IDs; 33 exact-auto folders excluded; `folder→Topic = zero mappings`; DB Topic is a later knowledge-result destination, **not** permission to write a Topic in K1.1.
- No migration, no DB/Vault write, no preprocess workflow invocation, and no auto-folder deletion in this implementation phase.

---

## Non-negotiable behavior contract

1. A post with a non-null `collection_id` returns `existing_collection_preserved` before resolving duplicate/related/folder input and makes no update.
2. A null-collection post may update only if the exact target ID is in the per-owner K1 allowlist; an unrecognized user gets an empty allowlist.
3. A target must also resolve to a row owned by the post user. An auto ID, non-existent ID, other-owner row, low-confidence direct proposal, or unallowlisted duplicate/related target leaves the post `collection_id: null`.
4. The final update must include `.is('collection_id', null)` plus `id` and `user_id`. A zero-row result is `collection_assignment_conflict`, never a retry that overwrites a user assignment.
5. No route creates a folder. `suggested_name` remains display-only and no `collection_collections.insert` path is added.
6. Folder routing never reads/writes `collection_topics`, `collection_topic_source_matches`, or aggregate fields. The approved mapping mode is explicitly `none`.
7. `persistTopicDecision` must read an existing match before agent upsert; a user `accepted` or `rejected` decision returns `existing_user_decision_preserved` and is not overwritten by an agent suggestion.

## Task 1: Create the immutable runtime taxonomy policy

**Objective:** Translate the private Owner-approved K1 artifact into a reviewable server policy with a fail-closed per-user resolver.

**Files:**
- Create: `server/config/ownerCollectionTaxonomy.js`
- Create: `test/server/owner_collection_taxonomy.test.js`
- Source of exact IDs: private `folder-whitelist.json` above; do not invent/rename categories.

**Step 1 — RED test**

Create tests proving:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { folderRoutingPolicyForUser } from '../../server/config/ownerCollectionTaxonomy.js';

test('owner taxonomy exposes exactly the approved K1 IDs and no auto IDs', () => {
  const policy = folderRoutingPolicyForUser('50984520-69ad-4e64-b9c1-503f5c1b0e63');
  assert.equal(policy.approvedCollectionIds.size, 20);
  assert.equal(policy.folderTopicMappingMode, 'none');
  assert.equal(policy.approvedCollectionIds.has('AUTO_FOLDER_ID_FROM_K1_ARTIFACT'), false);
});

test('unknown users fail closed with no permitted collection IDs', () => {
  assert.equal(folderRoutingPolicyForUser('different-user').approvedCollectionIds.size, 0);
});
```

Use one actual auto-folder ID copied from the frozen K1 artifact, never a made-up ID.

**Step 2 — verify RED**

```bash
node --test test/server/owner_collection_taxonomy.test.js
```

Expected: fail because the module does not exist.

**Step 3 — minimal implementation**

Export only:

```js
export const OWNER_COLLECTION_TAXONOMY = Object.freeze({
  '50984520-69ad-4e64-b9c1-503f5c1b0e63': Object.freeze([
    // exact 20 UUIDs copied from the frozen K1 artifact
  ])
});

export function folderRoutingPolicyForUser(userId) {
  return Object.freeze({
    approvedCollectionIds: new Set(OWNER_COLLECTION_TAXONOMY[userId] || []),
    folderTopicMappingMode: 'none'
  });
}
```

Do not read `/Volumes/DevSSD/...` at runtime; production must not depend on a private execution disk. Add a comment with the artifact path and checksum for auditability.

**Step 4 — verify GREEN**

```bash
node --test test/server/owner_collection_taxonomy.test.js
```

Expected: `2` passing tests.

**Step 5 — commit (only after all K1.1 tasks pass)**

Do not commit this task alone. Keep exact files staged later; never use `git add -A`.

---

## Task 2: Fail-close direct folder routing and preserve existing assignments

**Objective:** Harden `persistFolderDecision` at the single write boundary.

**Files:**
- Modify: `server/services/autonomousKnowledgeService.js:200-273`
- Modify: `test/server/autonomous_knowledge_service.test.js`

**Step 1 — RED tests, one behavior per test**

Add fake-client behavior tests for all of these; each test must assert the update call count and update filter chain:

1. Existing `post.collection_id` returns `{ assigned:false, reason:'existing_collection_preserved' }`; zero collection lookup/update calls.
2. Explicit unallowlisted ID returns `collection_not_approved`; zero update calls.
3. An exact auto ID returns `collection_not_approved`; zero update calls.
4. An allowed ID whose resolved row has another `user_id` returns `collection_not_found`; zero update calls.
5. Low-confidence explicit input returns `folder_confidence_low`; zero update calls.
6. Allowed, same-owner, null-collection input updates exactly once with `id`, `user_id`, and `collection_id IS NULL` filters.
7. A zero-row conditional update returns `collection_assignment_conflict`; no second update/retry.
8. Duplicate or related inheritance can only update when its `collection_id` is allowlisted; excluded inherited IDs leave Inbox.
9. A folder-only call never requests a Topic table.

Use a small fake builder that records `eq`, `is`, `update`, and `select` calls. Do not use a live Supabase project.

**Step 2 — verify RED**

```bash
node --test test/server/autonomous_knowledge_service.test.js
```

Expected: the new tests fail because current routing does not enforce an allowlist, does not preserve an already-assigned post, and lacks `.is('collection_id', null)`.

**Step 3 — minimal implementation**

- Add a private `approvedCollectionIds(options)` helper returning a `Set`; missing/invalid policy is an empty Set.
- At the start of `persistFolderDecision`, return `existing_collection_preserved` for a non-empty source post `collection_id`.
- Require `folderInput.collection_id` to be a member of `options.approvedCollectionIds` before direct lookup.
- Require high-confidence direct proposal (`>= 0.85`, matching `AUTONOMY_CONFIDENCE_THRESHOLD`) before direct assignment; do not import a circular dependency—pass the threshold via options from preprocess or use a local documented constant with an explicit equality test.
- Check inherited duplicate/related collection IDs against the same allowlist before any update.
- Keep `.eq('id', post.id).eq('user_id', post.user_id).is('collection_id', null)` on every `collection_posts.update`.
- If `.select(...).maybeSingle()` after the conditional update yields no row, return `collection_assignment_conflict` without retry.
- Keep folder result objects diagnostic: `assigned`, `reason`, `requested_collection_id`, `inherited_from_*` where relevant. Do not include raw post content.

**Step 4 — verify GREEN**

```bash
node --test test/server/autonomous_knowledge_service.test.js
```

Expected: all existing and new service tests pass.

---

## Task 3: Preserve human Topic decisions and prove folder/Topic isolation

**Objective:** Prevent agent upsert from replacing a prior user accepted/rejected Topic match; enforce the K1 zero folder→Topic mapping boundary.

**Files:**
- Modify: `server/services/autonomousKnowledgeService.js:132-198`
- Modify: `test/server/autonomous_knowledge_service.test.js`
- Modify: `test/script/topic_match_governance_hardening.test.js`

**Step 1 — RED tests**

Add two isolated Topic tests:

```js
test('agent topic suggestion preserves a user accepted match', async () => {
  // Fake match lookup returns { status:'accepted', decision_source:'user' }.
  // Assert no upsert occurs and reason is existing_user_decision_preserved.
});

test('agent topic suggestion preserves a user rejected match', async () => {
  // Fake match lookup returns { status:'rejected', decision_source:'user' }.
  // Assert no upsert occurs and reason is existing_user_decision_preserved.
});
```

Add a source-contract assertion that `persistFolderDecision` does not reference `collection_topics`, `collection_topic_source_matches`, or `rebuildTopicKnowledgeAggregate`. This tests the selected `folderTopicMappingMode: 'none'` boundary; it does not disable independent future Topic workflows.

**Step 2 — verify RED**

```bash
node --test test/server/autonomous_knowledge_service.test.js test/script/topic_match_governance_hardening.test.js
```

Expected: preservation tests fail because the current upsert can set agent `suggested` state over an existing row.

**Step 3 — minimal implementation**

Before `collection_topic_source_matches.upsert`, query the exact `(user_id, topic_id, source_id)` row for `status, decision_source`. If its decision source is `user` and status is `accepted` or `rejected`, return the existing match metadata with `deferred:true` and `reason:'existing_user_decision_preserved'`. Otherwise retain current agent suggested-upsert behavior.

Do not create a Topic, do not map any folder to a Topic, and do not call `rebuildTopicKnowledgeAggregate` in this task.

**Step 4 — verify GREEN**

```bash
node --test test/server/autonomous_knowledge_service.test.js test/script/topic_match_governance_hardening.test.js
```

Expected: all selected tests pass; test proves existing user decision is untouched.

---

## Task 4: Wire policy through preprocess without triggering a workflow

**Objective:** Ensure the production entry path supplies the fail-closed policy but test only imported code/static contract—never a real workflow ID.

**Files:**
- Modify: `scripts/agent-sdk/preprocess-workflow.js:6-15,211-221`
- Modify: `test/script/autonomous_preprocess_contract.test.js`

**Step 1 — RED test**

Add static-contract assertions that preprocess imports `folderRoutingPolicyForUser` and passes `approvedCollectionIds` plus `folderTopicMappingMode` into `persistFolderDecision`. Also assert the service’s no-Topic-table boundary from Task 3.

**Step 2 — verify RED**

```bash
node --test test/script/autonomous_preprocess_contract.test.js
```

Expected: failure because the policy is not yet imported/passed.

**Step 3 — minimal implementation**

After obtaining `post`, call:

```js
const folderRoutingPolicy = folderRoutingPolicyForUser(post.user_id);
```

Pass only this immutable policy to `persistFolderDecision` together with existing duplicate/related inputs. Do not alter `persistTopicDecision`, transition, Vault, outbox, Cron release, or POC branches.

**Step 4 — verify GREEN**

```bash
node --test test/script/autonomous_preprocess_contract.test.js
```

Expected: pass. This is a source wiring check, not a live workflow test.

---

## Task 5: Docker-isolated regression suite and evidence

**Objective:** Execute actual code and tests in an isolated runtime, with no live credentials or network.

**Files:**
- Create at run root: `/Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/routing-safety-evidence.md`
- Create at run root: `/Volumes/DevSSD/hermes/knowledge-organization/k0-20260916T002220+0800/auto-folder-cleanup-status.md`

**Step 1 — run targeted tests in Docker**

From repository root:

```bash
docker run --rm --network none \
  -v "$PWD:/app:ro" -w /app \
  node:20-alpine \
  node --test \
    test/server/owner_collection_taxonomy.test.js \
    test/server/autonomous_knowledge_service.test.js \
    test/script/topic_match_governance_hardening.test.js \
    test/script/autonomous_preprocess_contract.test.js
```

Expected: all tests pass. The mount is read-only; command has no Supabase URL/key and no workflow ID, so it cannot write DB/Vault or call network.

**Step 2 — run static quality checks in the same Docker isolation**

Only if ESLint dependencies are already available inside a prepared non-host cache/image. Do not install packages to the Mac host disk. Otherwise record `not-run: dependency image unavailable` rather than claiming lint passed.

**Step 3 — record evidence**

`routing-safety-evidence.md` must state exact image, command, output, selected test count, branch, commit (if any), and boundaries: Docker unit tests prove routing logic only, not live DB behavior or UI behavior.

`auto-folder-cleanup-status.md` must preserve: 33 exact auto folders, zero current post references at K0, **cleanup blocked by global delete prohibition**, no deletion attempted. Do not mark K1.1 complete because C4 remains blocked.

**Step 4 — exact staging / commit after evidence review**

```bash
git add \
  server/config/ownerCollectionTaxonomy.js \
  server/services/autonomousKnowledgeService.js \
  scripts/agent-sdk/preprocess-workflow.js \
  test/server/owner_collection_taxonomy.test.js \
  test/server/autonomous_knowledge_service.test.js \
  test/script/topic_match_governance_hardening.test.js \
  test/script/autonomous_preprocess_contract.test.js \
  docs/plans/2026-09-16-k1-1-routing-safety-implementation-plan.md

git commit -m "feat: enforce approved collection routing"
```

Do not stage the private `/Volumes/DevSSD/hermes/knowledge-organization/` artifacts, existing `.tmp/`, `.hermes-*`, or unrelated untracked plan files. Do not push or merge.

---

## Completion boundary

A passing Docker regression suite can mark only K1.1-C1/C2/C3 as runtime-tested if every listed behavior passes. K1.1-C4 remains **blocked** until a separately authorized, backed-up, legal cleanup path exists; hiding auto folders is not cleanup. K2/K3 require a separate explicit start and do not inherit this authorization.
