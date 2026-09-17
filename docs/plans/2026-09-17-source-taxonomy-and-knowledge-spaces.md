# Source Taxonomy and Cross-Folder Knowledge Spaces Implementation Plan

> **For Hermes:** Execute each code task test-first in the isolated `agent-dev` worktree. Do not perform bulk post reassignment or write Pilot proposals directly into live post assignments.

**Goal:** Establish a stable 20-category source taxonomy and an additive, source-cited second-layer knowledge-space model, beginning with the cross-folder `從 0 到 1 產品開發工作流` map.

**Architecture:** Keep every saved article in exactly one primary source collection (or Inbox when evidence is insufficient). Add separate `knowledge_spaces`, `knowledge_map_nodes`, and `knowledge_node_evidence` tables so a map can cite articles from many collections without copying posts or overwriting existing collection maps. The initial reader API is strictly JWT-scoped and read-only.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS; Node/Express service and routes; React/Vite reader UI; Node test runner; Docker `node:20-alpine` isolated verification.

**Authority boundary:** Owner approved Phase A+B and a 20–30-post **read-only** Pilot. This plan does not authorize creating/renaming/deleting live source folders, changing `collection_posts.collection_id`, or automatic bulk reclassification. Those require an accepted per-post manifest and a separate writeback approval.

---

## Frozen decisions

- Source folders are the first layer. A post has one primary collection only.
- Knowledge maps are a second layer. A node may cite posts from multiple collections.
- No automatic new category creation. Low-confidence or cross-cutting source classification stays Inbox with an explainable proposal.
- `Codex`, `prompt`, `skill`, and `package` are source attributes, not primary folders.
- Every visible technical claim must retain at least one source citation and indicate whether it is source-captured, author-claimed, or independently verified.
- The current `collection_knowledge_maps` reader remains intact during Phase B; no destructive migration.

## Task 1 — Publish the approved source taxonomy artifact

**Files:**
- Create: `docs/knowledge-taxonomy/source-taxonomy-v1.md`
- Create: `docs/knowledge-taxonomy/source-taxonomy-v1.json`

**Implementation:** Record 20 stable keys, proposed display names, inclusion rule, exclusion rule, and map affinities. Record that the proposed names are not yet live collection renames. Include a deterministic routing question: “Which future job will this source primarily help perform?”

**Verification:** JSON parse succeeds; every key is unique; exactly 20 categories; no category is named after a vendor or source format.

## Task 2 — Add failing taxonomy artifact contract tests

**Files:**
- Create: `test/server/source_taxonomy_v1.test.js`

**RED:** Assert taxonomy JSON has exactly 20 unique categories, each has `key`, `proposed_name`, `include`, `exclude`, and no primary name is `codex`, `prompt`, `好skill`, `好用套件`, or `其他`.

**GREEN:** Create the taxonomy JSON and pass the contract.

**Verification:** `node --test test/server/source_taxonomy_v1.test.js`.

## Task 3 — Add failing cross-folder knowledge-space migration contract

**Files:**
- Create: `test/script/knowledge_space_migration.test.js`
- Create: `database/deployments/stage_w_knowledge_spaces.sql`

**RED:** Require additive tables for spaces, nodes, and evidence; UUID owner fields; RLS owner read policies; evidence source post reference; node type checks; uniqueness preventing duplicate node/source/relation evidence; no `drop table`, `truncate`, or anonymous read grant.

**GREEN:** Implement one transactional additive migration. Preserve all existing collection knowledge-map tables and posts.

**Verification:** `node --test test/script/knowledge_space_migration.test.js`.

## Task 4 — Add failing reader-service behavior tests

**Files:**
- Create: `test/server/knowledge_space_service.test.js`
- Create: `server/services/knowledgeSpaceService.js`

**RED:** Test owner-scoped loading of a space with nodes and citable evidence; test no result yields `KNOWLEDGE_SPACE_NOT_FOUND`; reject a node that has no evidence; verify no service write path.

**GREEN:** Implement `loadKnowledgeSpace({ spaceId, userId, supabaseClient })`. It reads only user-owned rows and maps the normalized API response to: `space`, `nodes`, and `evidence`.

**Verification:** `node --test test/server/knowledge_space_service.test.js`.

## Task 5 — Add protected read-only API route

**Files:**
- Modify: `server/index.js`
- Create: `test/script/knowledge_space_route_contract.test.js`

**RED:** Assert `/api/knowledge-spaces/:spaceId` is behind `requireSupabaseJwt`, invokes the reader with `getAuthenticatedUserId(req)`, and exposes no write methods below this route.

**GREEN:** Add the GET endpoint and explicit 404/503 behavior matching existing knowledge-map semantics.

**Verification:** `node --test test/script/knowledge_space_route_contract.test.js`.

## Task 6 — Add reader UI contract for technical workflow maps

**Files:**
- Create: `src/components/KnowledgeSpaceMap.jsx`
- Create: `test/script/knowledge_space_ui_contract.test.js`

**RED:** Require visible node type, title, problem, concrete workflow/option/comparison fields, and inline citations that navigate to original posts. Prohibit a generic “summary-only” rendering contract.

**GREEN:** Implement a read-only component that loads the API using authenticated fetch, renders no content for 404, shows error state, and exposes each node’s cited evidence.

**Verification:** `node --test test/script/knowledge_space_ui_contract.test.js && npm run build`.

## Task 7 — Prepare Pilot inputs without post assignment writes

**Files:**
- Create (SSD, untracked): `/Volumes/DevSSD/hermes/knowledge-organization/<run-id>/pilot/manifest.json`
- Create (SSD, untracked): `/Volumes/DevSSD/hermes/knowledge-organization/<run-id>/pilot/classification-proposals.jsonl`
- Create (SSD, untracked): `/Volumes/DevSSD/hermes/knowledge-organization/<run-id>/pilot/knowledge-space-draft.md`

**Implementation:** Freeze a live read-only manifest of 20–30 representative posts across the relevant current folders. For each, record current folder, proposed v1 category, confidence, source excerpt, no-change reason / review reason, and explicit knowledge-space nodes to append. Do not update `collection_posts.collection_id` and do not create DB map nodes until Owner approves the Pilot artifact.

**Verification:** Verify exact post count, no duplicate IDs, all source excerpts non-empty, and all proposed categories are from v1 taxonomy. Report the list and evidence count to Owner.

## Task 8 — Docker verification and acceptance ledger

**Files:**
- Create: `test/script/knowledge_taxonomy_docker_contract.test.js` if necessary
- Create: `docs/plans/2026-09-17-source-taxonomy-and-knowledge-spaces-ledger.md`

**Verification command:**
```bash
POC_RUN_DIR="$PWD" docker compose -f sandbox/docker-compose.yml run --rm node-runner \
  node --test \
  test/server/source_taxonomy_v1.test.js \
  test/script/knowledge_space_migration.test.js \
  test/server/knowledge_space_service.test.js \
  test/script/knowledge_space_route_contract.test.js \
  test/script/knowledge_space_ui_contract.test.js
```

Record exact output and evidence boundaries. Docker contracts prove isolated file/API behavior only; they do not prove live migration or browser rendering.

## Live migration / deployment gate (not included in the current bulk reclassification authority)

Before applying `stage_w_knowledge_spaces.sql` to production: backup only the affected schema metadata and existing tables to `/Volumes/DevSSD/hermes/`, apply the additive migration, query RLS/table constraints back, and create the initial `從 0 到 1 產品開發工作流` space only after Owner approves the Pilot nodes. Deployment must then use the established PM2 process and public API verification.
