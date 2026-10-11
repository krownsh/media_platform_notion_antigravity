# Owner-guided retrieval metadata — implementation plan

> **Implementation state:** planning only. Do not begin these steps until the
> Owner explicitly approves implementation.

**Goal:** add no-cost, explainable, owner-scoped retrieval metadata to the current
owner-guided workflow. Existing raw evidence, explicit candidate review, and
accepted knowledge semantics remain intact.

## Guardrails before any code

1. Confirm `main` and its remote state; inspect `git status --short` first.
   Preserve the currently modified crawler/capture/skill files and the untracked
   nested-article test. They are outside this feature.
2. Re-read `hermes/skills/owner-guided-media-workflow/SKILL.md` and follow it as
   the only workflow authority. The shared-agent bootstrap paths named in
   `AGENTS.md` are currently absent; record that fact, but do not substitute
   legacy Hermes or Knowledge Space behavior.
3. Keep every query and migration collection-scoped. Do not read, write, restart,
   or deploy the stock application.

## 1. Lock the database contract

**Files:**

- Create `database/deployments/stage_y_owner_guided_retrieval_metadata.sql`.
- Update `database/deployments/schema_aggregator.sql` only if that file is the
  project’s actual deployment manifest; otherwise leave it unchanged and document
  the deployment command.
- Add database/RPC contract coverage alongside the existing
  `test/server/owner_guided_search.test.js` fixtures (or a focused sibling test).

**Work:**

1. Create `owner_post_retrieval_terms` with `id`, `user_id`, `post_id`,
   `source_revision_id`, `term`, `normalized_term`, `term_kind`, `visibility`,
   `evidence_excerpt`, `created_at`, and `updated_at`. Constrain kinds to
   `source_keyword`, `entity`, `alias`, `memory_cue`, `discussion_cue`, and
   `formal_knowledge`; constrain visibility to `active`/`hidden`. Add a unique
   owner/post/normalized-term/kind identity that makes reruns idempotent.
2. Create `owner_post_retrieval_term_provenance`, keyed by the retrieval term,
   with `user_id`, optional `source_revision_id`, optional local discussion event
   id, optional accepted-review/proposal id, `origin`, and timestamps. Enforce
   that the provenance belongs to the same owner/post as its term.
3. Enable RLS on both tables; permit only `auth.uid() = user_id`. Add indexes for
   owner/post, active term lookup, normalized matching, and provenance joins.
   Add comments describing every structured field and permitted origin.
4. Extend `owner_post_search_documents` with non-null `retrieval_text` and a
   generated `retrieval_vector`; add GIN/trigram indexes. Do not alter or reuse
   `candidate_text` for retrieval metadata.
5. Extend `upsert_owner_post_search_document` to accept `p_retrieval_text` and
   update only that derived projection. Extend `search_owner_post_documents` to
   include active retrieval matches by default, retain candidate exclusion unless
   `p_include_candidates = true`, and return stable labels such as
   `retrieval_source_keyword`, `retrieval_alias`, and `retrieval_discussion_cue`.
6. Test the migration in an isolated Supabase environment before production:
   RLS isolation, idempotent upsert, hidden-term exclusion, raw/formal/default
   retrieval, candidate opt-in, and no cross-owner RPC result.

## 2. Build a deterministic retrieval-metadata service

**Files:**

- Create `server/services/retrievalMetadataService.js`.
- Modify `server/services/ownerSearchService.js`.
- Add `test/server/retrieval_metadata_service.test.js`.
- Extend `test/server/owner_guided_search.test.js`.

**Work:**

1. Implement pure functions first: whitespace/Unicode-safe normalization,
   deduplication, length/count limits, provenance validation, and deterministic
   extraction from title, author, platform, URL host/path, hashtags, mentions,
   and bounded text/comment phrases. Never add a term that has no source excerpt.
2. Make the extractor return structured records rather than strings:
   `{ term, normalizedTerm, kind, evidenceExcerpt, origin }`. It must be safe to
   rerun on the same revision with no duplicate rows.
3. Add service functions to upsert terms/provenance, list active terms for one
   owner/post, hide one owner term, derive source terms, derive post-discussion
   cues, and derive formal-knowledge terms. All callers provide `userId` and
   `postId`; none may default to a global owner.
4. Extend `loadOwnerSearchInputs` to load active retrieval terms. Extend
   `buildOwnerSearchDocument` with `retrieval_text`; retain current raw/formal/
   candidate construction exactly so existing search behavior cannot silently
   move across semantic layers.
5. Test Chinese, English, mixed punctuation, duplicate variants, blanks,
   over-limit inputs, author/URL terms, evidence-required rejection, hiding, and
   that a candidate proposal never becomes retrieval metadata solely by existing.

## 3. Wire only permitted lifecycle triggers

**Files:**

- Modify `server/services/captureFinalizationService.js`.
- Modify `server/services/reviewPromotionService.js`.
- Modify `server/services/localMediaKnowledgeWorkflowService.js` and/or
  `server/services/localMediaKnowledgeService.js`.
- Add focused tests such as `test/server/capture_finalization.test.js`,
  `test/server/review_promotion.test.js`, and
  `test/server/local_media_knowledge_workflow.test.js` (use the project’s actual
  nearby test naming if already present).

**Work:**

1. After source finalization succeeds, derive/upsert source terms, then refresh
   the owner search projection. A metadata failure must be visible and retryable;
   it must not revoke a successfully saved source or create an accepted decision.
2. After a post-scoped discussion event is saved, derive/upsert its discussion
   cues, append the human-readable event and cues to that post’s case file, and
   refresh search. Do not ingest generic chat history.
3. After `accept` or `edit_and_accept`, derive terms from the newly accepted
   learning/Topic/Project content, then refresh search and local projections. A
   reject must not produce formal-knowledge terms.
4. Preserve capture’s existing provisional Inbox case-file behavior. The server,
   not Cloudflare/browser code, remains the only filesystem writer. Local-write
   failure is recorded/retryable and cannot roll back the database event.
5. Write integration tests proving ordering, retry idempotency, failure
   boundaries, and that all semantic promotion still needs explicit Owner action.

## 4. Add narrow owner controls and visible meaning

**Files:**

- Modify `src/api/searchApi.js` and add a small retrieval API module only if a
  dedicated route is needed.
- Modify `src/pages/SearchPage.jsx`.
- Modify the current owner-guided post-detail page/component that renders the
  local-record/review panel (resolve its exact path before editing).
- Add owner-authenticated routes in `server/routes/searchRoutes.js` or a new
  `server/routes/retrievalMetadataRoutes.js`; register it in `server/index.js`.
- Extend `test/script/owner_guided_search_ui_contract.test.js` and add component
  tests if the existing test harness supports them.

**Work:**

1. Keep normal Library search unchanged in shape, but add clear match chips:
   `來源內容`, `自動檢索：關鍵字/別名/記憶線索/討論`, `已接受知識`, and the existing
   explicit `候選內容` state. Never call automatic retrieval content “已接受”.
2. On post detail, display active clues in a collapsed, low-noise section with
   kind and source (captured source, this-post discussion, or accepted content).
   Provide one explicit `隱藏這個線索` control. It affects only that retrieval
   term and shows its effect immediately after reindexing.
3. Explain the stage in UI: automatic clues improve finding posts; they do not
   classify or publish knowledge. Preserve the current one-next-step review UI.
4. Route handlers must authenticate, scope every lookup/update by `user_id`,
   validate term UUIDs, and return no raw local filesystem paths beyond existing
   relative display fields.

## 5. Rebuild current data safely

**Files:**

- Replace/extend `scripts/maintenance/rebuild-owner-guided-search-index.js` with
  an explicitly named retrieval rebuild mode, or create
  `scripts/maintenance/rebuild-owner-guided-retrieval-metadata.js`.
- Add `test/script/rebuild_owner_guided_retrieval_metadata.test.js`.
- Add an operator runbook section to this plan or a new
  `docs/architecture/owner-guided-retrieval-metadata-operations.md`.

**Work:**

1. Implement `--dry-run`, explicit `--user-id`, bounded `--page-size`,
   checkpoint/resume output, and a `--source-only` default. Refuse a run without
   an explicit scope; never run it from a request handler or PM2 worker loop.
2. First produce a dry-run count of eligible owner-guided captured posts and
   source-term counts. Owner reviews the count before a write run.
3. Write only deterministic source-derived terms for current source revisions;
   upsert is idempotent. Do not migrate old vault prose or copy legacy
   `collection_post_search_documents` terms blindly. If legacy terms are ever
   considered, require evidence matching against that same raw source and log the
   rejection count.
4. Refresh each projection after its term upsert. Emit only counts/post IDs and
   error classes in logs—never source body text or credentials.
5. Compare pre/post results with fixed test queries, check tenant isolation, and
   retain the old index tables untouched for rollback. Rollback means disabling
   retrieval matching in the RPC/UI, not deleting ledger history.

## 6. Verification and release gate

1. Run targeted Node tests with the bundled Node runtime, then `npm run lint` and
   `npm run build`. Resolve unrelated failures separately; do not change crawler
   files to make this feature pass.
2. Apply the SQL only after reviewing its exact migration in staging or a
   dedicated test project. Production Supabase changes, production rebuilds,
   service restarts, and GitHub pushes each require their own explicit Owner
   authorization at execution time.
3. Manually verify one newly captured post, one post-scoped discussion, one
   accepted knowledge action, and one hidden clue. In each case confirm the UI
   phase text, search reason, database provenance, and readable local case-file
   projection agree.
4. Report a concise completion ledger: migration version, test commands/results,
   posts processed, terms created/hidden/rejected, known failures, and the one
   next Owner action.

## Completion criteria

- A source word, automatic alias/memory clue, meaningful post discussion, and
  accepted note each find the same post through normal Library search.
- The UI explains the matching layer without implying automatic acceptance.
- A wrong automatic clue can be hidden by the Owner without altering source or
  formal knowledge.
- Reprocessing is safe and owner-scoped; no legacy garbage, stock data, or paid
  service is introduced.
- Every meaningful post-scoped event is represented in the database ledger,
  search projection, and local Markdown case file, with failures recoverable.
