# Legacy Physical Retirement Manifest (M7 — Prepared, Not Approved)

**No deletion or schema change is authorized by this document.** M6 only
removed old paths from normal navigation; historical code, endpoints, jobs and
data remain until an explicit Owner decision.

## Candidate retirement batches

| Batch | Exact scope | Evidence / required gate | Reversible first move |
| --- | --- | --- | --- |
| A — unreachable frontend | `src/pages/ViewAllPage.jsx`, `src/pages/InsightPage.jsx`, the retired collection/card/detail/remix components, and legacy-only UI tests | `src/App.jsx` imports none; remaining imports were inside this retired cluster. **Completed locally** with the complete repository lint/test/build gate; the Git commit remains its recovery point. | Restore the dedicated commit if a removed legacy view is unexpectedly needed. |
| B — legacy public API | `/api/posts`, `/api/stats`, `/api/analyze-post`, `/api/rewrite`, `/api/remix`, `/api/image-workflow`, `/api/publish`, `/api/batch-classify`, `/api/topics`, `/api/projects`, `/api/agent/jobs`, `/api/poc-workbench`, `/api/parallel-tracks` | Although the frontend no longer navigates here, external clients may exist. Require 14 days of endpoint telemetry and explicit Owner confirmation. | Return a documented deprecation response first; never silently repurpose a path. |
| C — background workflow | `scripts/agent-sdk/*workflow*.js`, `analyze-item.js`, `outbox-lease.js`, `preprocess-workflow.js`, `vault-sync-workflow.js`; services `postWorkflowService.js`, `hermesOutboxService.js`, `autonomousKnowledgeService.js`, `codexRemotePreprocessService.js` | These still call one another and can write old analysis/workflow/outbox state. Inspect scheduler/PM2/crons and obtain Owner approval before stopping every producer. | Disable one job with an explicit logged config change and observe zero new legacy writes for 14 days. |
| D — legacy search | `server/services/postSearchService.js`, `scripts/maintenance/rebuild-search-index.js`, `database/deployments/stage_n_post_search_documents.sql`, plus old agent callers | M5 replaces normal search but agent scripts still call this projection. Batch C must be frozen and remote consumers/readback checked. | Stop writers; preserve table; revoke legacy RPC only after approval. |
| E — Knowledge Space / old Topic-project schema | `server/services/knowledgeSpaceService.js`, `stage_w*.sql`, legacy `collection_topics`, `collection_projects`, governance/aggregate services and migrations | User marked this as old architecture, but it may contain historical data. Require remote object inventory, per-user counts, verified backup, retention period, and explicit per-table Owner approval. | Hide/revoke routes first. Never delete applied deployment migration files; use a reviewed forward migration. |

## Protected data

Never use wildcard table drops. Preserve `collection_posts`,
`collection_source_revisions`, `collection_post_media`,
`collection_post_comments`, `collection_capture_requests`, review/audit records,
M3/M4 owner tables, `owner_post_search_documents`, and
`collection_collections` (still used by owner-guided folder decisions).

## Mandatory evidence before any physical removal

1. Export remote schema/object inventory and per-user row counts.
2. Create and verify a restorable backup for each approved data-bearing table.
3. Confirm no old endpoint traffic or scheduler/PM2/cron producer in the
   agreed observation window.
4. Run full owner-guided regression and authenticated staging readback.
5. Present exact files, endpoints, jobs, tables, retention and rollback to
   the Owner; obtain approval for the selected batch only.

## Explicit decision needed

Choose **none, A, A+B, or a custom batch**. B–E cannot proceed from repository
inspection alone because they can affect external clients, jobs or history.

## 2026-10-06 local process readback

PM2 reports both `media-collection-server` and
`media-collection-capture-worker` online from the original project checkout,
not this rebuild worktree. This proves B–D are live-process changes and must
not be removed or stopped from the rebuild branch. PM2 detailed process
inspection can expose environment credentials; do not capture it in logs or
documents, and rotate any credentials that appeared in a local diagnostic
output.

## 2026-10-06 deployment-readiness readback

The running checkout is `main`; it is an ancestor of this rebuild branch by
12 commits, but it has uncommitted user changes and untracked local artifacts.
Do not reset, checkout over, or force-update it. Deployment requires a
separate Owner-approved integration step that first preserves/reconciles that
working tree, then applies the reviewed commits, restarts only the intended
services, and checks capture/review/search readback.
