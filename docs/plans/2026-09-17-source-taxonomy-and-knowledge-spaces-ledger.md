# Source Taxonomy and Knowledge Spaces — Acceptance Ledger

> Last verified: 2026-09-25. This ledger distinguishes implementation, Docker contract evidence, live schema evidence, and authenticated browser evidence. It does not claim browser interaction verification unless an authenticated live reader request has actually been exercised. The 2026-09-25 Phase 1 readback below is the current live-project schema authority; historical live-schema claims above it are not current-project proof.

| Scope | Required acceptance condition | Artifact / exact evidence | Boundary | Status | Remaining gap |
|---|---|---|---|---|---|
| Taxonomy v1 | Exactly 20 stable proposed categories; no folder mutation authority | `docs/knowledge-taxonomy/source-taxonomy-v1.json`; Docker `source_taxonomy_v1.test.js`: 2 passed | Static artifact + isolated Node test | Pass | Human review before any collection rename/reassignment |
| Base knowledge-space schema | Additive tables for spaces, nodes, source evidence; owner-only reads and evidence required | `stage_w_knowledge_spaces.sql` design exists; 2026-09-25 current-project `to_regclass` readback reports `knowledge_spaces`, `knowledge_map_nodes`, and `knowledge_node_evidence` all absent | Historical deployment record + current production schema metadata | Not verified on current project | Apply only after a separately authorized migration, then re-query RLS/table constraints. |
| W3 reader-schema repair | Reader-required `taxonomy_version`, node `slug`, deterministic legacy fallback, and per-space slug uniqueness without source-folder mutation | `database/deployments/stage_w3_knowledge_space_reader_schema.sql` exists; its prerequisite live `knowledge_spaces` relation is absent in the 2026-09-25 current-project readback | Historical deployment record + current production schema metadata | Not verified on current project | Re-apply only after separately authorized base migration; re-query columns/constraints and deployment state. |
| Cross-folder scope audit | Explicit M:N scope must be owner-bound to existing folders, RLS-protected, and must not move posts | `stage_w2_knowledge_space_collections.sql` design exists; 2026-09-25 current-project `to_regclass` readback reports `knowledge_space_collections` absent | Historical deployment record + current production schema metadata | Not verified on current project | Apply only after a separately authorized migration, then re-query scope rows/RLS; no folder reassignment authority. |
| Reader API | JWT protected, owner scoped, read-only, returns explicit source-folder scope and cited nodes | `server/services/knowledgeSpaceService.js`, `server/index.js`; Docker route/service contracts passed; after PM2 restart on 2026-09-18, unauthenticated live `GET /api/knowledge-spaces/006ae3e5-a6e7-4334-b6fc-befd5c80dc9b` returned `401 {"error":"Unauthorized"}` | Isolated contract + live route/JWT-gate probe | Partial | Authenticated owner request and returned cited payload remain untested. |
| Reader UI | Displays declared folders, technical nodes, and source citations with post navigation | `src/components/KnowledgeSpaceMap.jsx`; Docker UI/page contracts passed and Vite build passed | Static/UI contract and production bundle only | Partial | Browser control endpoint has no running logged-in session; interactive authenticated browser check remains untested. |
| Pilot | 20–30 existing posts have a read-only, evidence-cited classification and knowledge-map proposal | Historical record names space `006ae3e5-a6e7-4334-b6fc-befd5c80dc9b`; 2026-09-25 current-project schema readback finds no `knowledge_spaces`, scope, node, or evidence table | Historical record + current production schema metadata | Not verified on current project | Do not treat the historical Pilot as live current-project evidence; new Pilot requires an explicit Owner-selected project/map and separately authorized schema deployment. |
| Source-folder changes | No collection reassignment, folder creation, rename, or deletion without approved per-post manifest | Live readback: all 9 cited source posts match their original folders | Authorized live-safe verification | Not performed by design | Separate explicit writeback approval required |

## Latest verification commands

```bash
# Docker, read-only source mount, no network for contracts
 docker run --rm --network none -v "$PWD:/workspace:ro" -w /workspace node:20-alpine \
   node --test \
   test/server/source_taxonomy_v1.test.js \
   test/script/knowledge_space_migration.test.js \
   test/script/knowledge_space_scope_migration.test.js \
   test/server/knowledge_space_service.test.js \
   test/script/knowledge_space_route_contract.test.js \
   test/script/knowledge_space_ui_contract.test.js \
   test/script/knowledge_space_page_contract.test.js
# Actual result: 9 passed, 0 failed.

# Docker clean Linux dependency install and build; source stays read-only, output is /tmp/dist in the container
 docker run --rm -v "$PWD:/workspace:ro" -v /workspace/node_modules -w /workspace node:20-bookworm-slim \
   sh -lc 'npm ci --ignore-scripts >/dev/null && ./node_modules/.bin/vite build --outDir /tmp/dist'
# Actual result: built successfully in 1.91s.
```

## 2026-09-18 Pilot and deployment readback

```text
Live Pilot readback: 1 published space; 4 scopes; 6 published nodes;
node evidence counts [2,2,2,1,1,1]; 9/9 cited posts retained their original folder.

PM2 process: media-collection-server restarted on 2026-09-18 after local main integrated reader commits; status online.
Unauthenticated live GET /api/knowledge-spaces/006ae3e5-a6e7-4334-b6fc-befd5c80dc9b:
401 {"error":"Unauthorized"}
```

The 401 is deployment and JWT-gate evidence: it proves the live PM2 process has loaded the protected reader route. It is not an authenticated payload or browser acceptance result.

## Phase 0 governance record — 2026-09-25

| Scope | Required acceptance condition | Artifact / exact evidence | Boundary | Status | Remaining gap |
|---|---|---|---|---|---|
| v1 immutability | The canonical 20-category artifact remains unchanged while expansion governance is revised | `docs/knowledge-taxonomy/source-taxonomy-v1.json`; SHA-256 `faed35ab09c99cca42344fb1b9b8f99088f78496085f7e8ee7d21e393c21ad0c`; Docker `source_taxonomy_v1.test.js` | Static file integrity + isolated Docker runtime | 2026-09-25: `node:20-alpine`, `--network none`, read-only source mount: 3 passed, 0 failed | Does not prove any live collection or routing behavior | Pass | Owner document review. |
| v2 governed expansion | Expansion has explicit preconditions, new immutable version + decision-record artifacts, and no implicit live authority | `docs/knowledge-taxonomy/source-taxonomy-v2.json`; `docs/knowledge-taxonomy/decisions/2026-09-25-governed-expansion-and-owner-first-map.md`; Docker `source_taxonomy_v1.test.js` | Documentation / static contract + isolated Docker runtime | 2026-09-25: `node:20-alpine`, `--network none`, read-only source mount: 3 passed, 0 failed | Does not prove any live collection or routing behavior | Pass | Owner document review. |
| Legacy boundary | Existing collections are legacy historical context, not a primary routing allowlist; no bulk reassignment or delete is authorized | `source-taxonomy-v2.json` `legacy_collection_policy` | Documentation only | Complete as documentation | Phase 1 read-only inventory and manifest require separate Owner authorization. |
| Owner-first map gate | Folder equivalence is forbidden; automatic post-to-map is disabled; an Owner must select an existing map/project or approve a new map | `source-taxonomy-v2.json` `knowledge_map_policy`; project skill governance override | Documentation only | Complete as documentation | Phase 6 pilot requires separate Owner authorization. |
| Runtime routing gate | Capture stays capture-only and may not select/write a source folder before Phase 4 Docker + authorized live validation | `source-taxonomy-v2.json` `phase_gate`; active profile SOUL; project skill governance override | Documentation only | Complete as documentation | Phase 2 implementation and Phase 4 validation remain unstarted. |

**Phase 0 evidence boundary:** this section documents file-level governance only. It is not Docker, Browser, PM2, Vault, DB, collection, post, knowledge-map, or live readback evidence.

## Phase 1 inventory record — 2026-09-25

| Scope | Required acceptance condition | Artifact / exact evidence | Boundary | Status | Remaining gap |
|---|---|---|---|---|---|
| Legacy collection inventory | Every legacy collection has owner, ID/name, post/map/scope/workflow reference result and no inferred migration | `docs/knowledge-taxonomy/inventory/2026-09-25-phase-1-read-only-manifest.md`; current-project readback: 53 collections, 18 reference-blocked, 35 four-reference-zero candidates; fingerprint `fb494e476c973cf6fbb00911433b4937` | Live read-only `SELECT` | Pass | Owner must decide whether 35 candidates later remain visible legacy or enter a separate retired/hidden proposal. |
| Canonical bootstrap manifest | All 20 v1 categories record key/name/include/exclude/space-affinity/future DB destination without writing them | Same manifest §2; v1 SHA-256 `faed35ab09c99cca42344fb1b9b8f99088f78496085f7e8ee7d21e393c21ad0c` | Static canonical artifact + live-read-only planning record | Pass | Owner manifest confirmation; Phase 3 requires separate live write authorization. |
| Topics, matches, knowledge-map schema | Inventory exists without treating legacy topic/match metadata as first-layer taxonomy and without claiming undeployed schema | Same manifest §§4–5; 71 topics (60 auto/archived, 11 user/active), 60 source matches; four target knowledge-space relations all absent | Live read-only `SELECT` | Pass | Current-project knowledge-space migration and any Pilot remain unstarted/unverified. |
| Legacy retirement | No legacy collection is changed before manifest review | Same manifest; no DML/DDL issued | Live read-only boundary | Not performed by design | Owner must confirm manifest before any later Phase; delete remains separately gated by backup, re-query, per-ID approval and readback. |

**Phase 1 evidence boundary:** evidence proves only the query results for the named Supabase project at `2026-09-25T05:42:10Z` and local document content. It is not a DB migration, collection retirement, UI routing, Docker Phase 2 evidence, Browser evidence, PM2/Cron action, post reclassification, Vault write, or knowledge-map mutation.
