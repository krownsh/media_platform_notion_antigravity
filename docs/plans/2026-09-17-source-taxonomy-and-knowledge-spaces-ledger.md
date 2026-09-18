# Source Taxonomy and Knowledge Spaces — Acceptance Ledger

> Last verified: 2026-09-18. This ledger distinguishes implementation, Docker contract evidence, live schema evidence, and authenticated browser evidence. It does not claim browser interaction verification unless an authenticated live reader request has actually been exercised.

| Scope | Required acceptance condition | Artifact / exact evidence | Boundary | Status | Remaining gap |
|---|---|---|---|---|---|
| Taxonomy v1 | Exactly 20 stable proposed categories; no folder mutation authority | `docs/knowledge-taxonomy/source-taxonomy-v1.json`; Docker `source_taxonomy_v1.test.js`: 2 passed | Static artifact + isolated Node test | Pass | Human review before any collection rename/reassignment |
| Base knowledge-space schema | Additive tables for spaces, nodes, source evidence; owner-only reads and evidence required | `stage_w_knowledge_spaces.sql`; production tables present with RLS and SELECT policies | Production schema metadata | Pass | None |
| W3 reader-schema repair | Reader-required `taxonomy_version`, node `slug`, deterministic legacy fallback, and per-space slug uniqueness without source-folder mutation | `database/deployments/stage_w3_knowledge_space_reader_schema.sql`; live insert/readback succeeded for taxonomy version and node slugs; Docker migration contract passed | Authorized live additive schema/write verification + isolated Docker contract | Pass | Deployed to PM2 on 2026-09-18 |
| Cross-folder scope audit | Explicit M:N scope must be owner-bound to existing folders, RLS-protected, and must not move posts | `stage_w2_knowledge_space_collections.sql`; production: `knowledge_space_collections`, RLS true; live Pilot readback shows 4 owner-bound scopes | Production schema and approved Pilot record readback | Pass | None for scope definition; no folder reassignment authority |
| Reader API | JWT protected, owner scoped, read-only, returns explicit source-folder scope and cited nodes | `server/services/knowledgeSpaceService.js`, `server/index.js`; Docker route/service contracts passed; after PM2 restart on 2026-09-18, unauthenticated live `GET /api/knowledge-spaces/006ae3e5-a6e7-4334-b6fc-befd5c80dc9b` returned `401 {"error":"Unauthorized"}` | Isolated contract + live route/JWT-gate probe | Partial | Authenticated owner request and returned cited payload remain untested. |
| Reader UI | Displays declared folders, technical nodes, and source citations with post navigation | `src/components/KnowledgeSpaceMap.jsx`; Docker UI/page contracts passed and Vite build passed | Static/UI contract and production bundle only | Partial | Browser control endpoint has no running logged-in session; interactive authenticated browser check remains untested. |
| Pilot | 20–30 existing posts have a read-only, evidence-cited classification and knowledge-map proposal | Approved cross-folder Pilot created live: space `006ae3e5-a6e7-4334-b6fc-befd5c80dc9b`, 4 scopes, 6 nodes, 9 evidence rows; each node has at least one citation | Authorized live limited write plus live readback | Pass | Pilot is intentionally 9 cited selected posts for the approved initial map, not a 20–30-post reclassification run. |
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
