# Source Taxonomy and Knowledge Spaces — Acceptance Ledger

> Last verified: 2026-09-17. This ledger distinguishes implementation, Docker contract evidence, and live schema evidence. It does not claim Pilot creation or browser interaction verification.

| Scope | Required acceptance condition | Artifact / exact evidence | Boundary | Status | Remaining gap |
|---|---|---|---|---|---|
| Taxonomy v1 | Exactly 20 stable proposed categories; no folder mutation authority | `docs/knowledge-taxonomy/source-taxonomy-v1.json`; Docker `source_taxonomy_v1.test.js`: 2 passed | Static artifact + isolated Node test | Pass | Human review before any collection rename/reassignment |
| Base knowledge-space schema | Additive tables for spaces, nodes, source evidence; owner-only reads and evidence required | `stage_w_knowledge_spaces.sql`; production tables present with RLS and SELECT policies | Production schema metadata, not populated records | Pass | No live space/node/evidence records until Pilot approval |
| Cross-folder scope audit | Explicit M:N scope must be owner-bound to existing folders, RLS-protected, and must not move posts | `stage_w2_knowledge_space_collections.sql`; production: `knowledge_space_collections`, RLS true, row count 0; FK `(space_id,user_id)` → `knowledge_spaces(id,user_id)` and `(collection_id,user_id)` → `collection_collections(id,user_id)` | Production schema metadata; 0 rows confirms migration did not create Pilot scope | Pass | Pilot must supply reviewed source folders |
| Reader API | JWT protected, owner scoped, read-only, returns explicit source-folder scope and cited nodes | `server/services/knowledgeSpaceService.js`, `server/index.js`; Docker contracts: route/service passed | Isolated contract; live API requires a real approved space | Pass | Browser/live request remains untested because no Pilot data exists |
| Reader UI | Displays declared folders, technical nodes, and source citations with post navigation | `src/components/KnowledgeSpaceMap.jsx`; Docker UI/page contracts passed and Vite build passed | Static/UI contract and production bundle only | Pass | Interactive browser check waits for approved Pilot space |
| Pilot | 20–30 existing posts have a read-only, evidence-cited classification and knowledge-map proposal | Not created | No live content writes | Not started | Owner must approve the pilot selection/run and then review output |
| Source-folder changes | No collection reassignment, folder creation, rename, or deletion without approved per-post manifest | Production `knowledge_space_collections` row count = 0; no Pilot data inserted | Live schema readback | Not performed by design | Separate explicit writeback approval required |

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
