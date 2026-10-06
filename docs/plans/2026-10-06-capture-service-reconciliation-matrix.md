# Capture-service integration reconciliation matrix

## Status and boundary

This is a reviewable implementation matrix for Task 2 of the owner-guided
deployment plan. It is **not authorized** to create a worktree, alter the
original checkout, apply a database migration, restart a service, or push a
branch.

The source comparison on 2026-10-06 used three inputs:

1. the running checkout's `main` baseline;
2. its user-owned, uncommitted edits to the two capture services; and
3. rebuild commit `a74c7ec` on `codex/media-workflow-rebuild`.

The original checkout must be read again immediately before integration. Its
dirty state is user-owned evidence, not an implicit merge instruction.

## Non-negotiable contract

The owner-guided migration accepts only `capture_quality in ('complete', 'partial')`. The integration must therefore never carry forward the old
`degraded` database value. A failed non-core crawl becomes a retained,
`captureQuality: 'partial'` source; a core-platform crawl failure remains
retryable and creates no fallback source.

Capture persists raw facts only. Its finalizer must pass `p_analysis: {}` and
return a `source_revision_id`. A complete source automatically projects a
review packet and candidate drafts through `prepareInitialReviewProposals`, but
that projection is not a promotion: no folder, post learning note, Topic,
project reference, POC, or other formal record may be written without Owner
acceptance.

`refreshOwnerPostSearchDocument` is a non-fatal M5 projection. It replaces the
old legacy search writer. Legacy automated analysis, generated-title
persistence, workflow initialization, and outbox routing do not return in this
integration. Worker completion records `outboxEventId: null`.

## Decision matrix

| Concern | Running checkout's dirty implementation | Rebuild contract to retain | Integration result and acceptance evidence |
| --- | --- | --- | --- |
| Capture-time semantics | Removes automatic URL analysis and workflow updates. | `p_analysis: {}`; capture has no formal semantic writes. | Preserve the removal. `test/server/capture_processing.test.js` and `test/server/capture_finalization.test.js` must pass. |
| Generic crawler fallback | Stores a human-readable degraded-link title and raw error detail, but reports obsolete `degraded` quality. | A fallback is a `fallback_link`, finalizes a durable source revision, and uses `captureQuality: 'partial'`. | Keep title `連結存檔（擷取降級）`; retain bounded error evidence (4,000 characters) in `full_json.capture_error`; use `partial`, never `degraded`. |
| Core-platform failures remain retryable | Does not create a fallback. | Threads/X failures remain retryable and do not save an incomplete source. | Preserve exactly; test the finalizer is never called. |
| Extracted-source finalization failure | Existing local direction avoids a second fallback after database failure. | A successfully extracted source is never overwritten by fallback data. | Preserve exactly: do not overwrite extracted source data with fallback; let the worker retry through its durable request state. |
| Finalizer response | Requires only post identity and retains old search projection. | Requires `post_id` plus `source_revision_id`; owner-guided search/review projections are non-fatal. | Replace old search lookup with `refreshOwnerPostSearchDocument`; call `prepareInitialReviewProposals`; test each deferred projection does not lose raw capture. |
| Complete source review | No existing owner-review packet flow. | Candidate drafts are automatically prepared; Owner reviews in Focus Mode and must explicitly accept formal knowledge. | Keep automatic candidate projection for complete sources only; do not expose a manual generation step as the normal next action. |
| Partial source review | No review-domain distinction. | Packet explains the quality state but semantic candidates require explicit `allow_partial`. | Do not generate proposal input until the Owner selects **以目前來源建立候選**. |
| Image capture | Removes image analysis/workflow update. | Persist private-media facts and a complete source revision, without AI/workflow/outbox writes. | Preserve both directions; return `sourceRevisionId` and `outboxEventId: null`. |
| Request completion | Old lifecycle can carry outbox identifiers. | Owner-guided request completion requires final status, `source_revision_id`, and a null legacy outbox. | Verify worker passes `status: 'finalized'`, quality `complete`/`partial`, source revision, and `outboxEventId: null`. |
| Idempotency and retry | Existing request correlation and worker retry behavior remains valuable. | Owner-guided finalizer keys source revisions by `(user_id, correlation_id)`. | Preserve the request/lease flow; do not substitute a new correlation id during reconciliation. |

## Manual reconciliation procedure

1. In the approved, separate integration worktree, preserve the original
   checkout's dirty files before applying rebuild commits.
2. Start from rebuild versions of both capture services, then carry over only
   the two explicitly selected raw-capture behaviors in this matrix: the
   degraded-link display title and the 4,000-character bounded error evidence.
3. Confirm no import or call remains for `analyzeCapturedUrl`,
   `updateWorkflowAfterCapture`, `persistGeneratedTitle`,
   `upsertPostSearchDocument`, or legacy outbox routing in either service.
4. Confirm every fallback passes `captureQuality: 'partial'`, every complete
   capture passes `captureQuality: 'complete'`, and no request completion
   writes `degraded`.
5. Run the full lint, test, and build gates before committing the integration.
   A new conflict, migration error, or changed capture boundary is a stop
   condition—not an invitation to choose one side wholesale.

## Required proof before service switch

The integration review must show:

- the exact two-service diff against the preserved baseline;
- a green regression suite including the capture-processing, finalization,
  owner-review, and candidate-review tests;
- the M1→M5 migration inventory and verified backup/readback for the named
  target; and
- an authenticated smoke test proving a complete source reaches Focus Mode,
  a partial source requires explicit continuation, and no formal record is
  created without acceptance.

Until the Owner supplies the deployment approvals named in
`2026-10-06-owner-guided-deployment-integration.md`, this matrix remains a
local implementation aid only.
