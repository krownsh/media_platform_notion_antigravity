# Collection legacy retirement plan

Status: prepared only; no destructive SQL in this document has been applied.

## Boundary

This plan covers only the superseded collection workflow. It never enumerates,
alters, or drops stock tables, functions, services, or processes.

The owner-guided path is now the source of truth:

`collection_posts` → `collection_source_revisions` → `owner_review_packets`
→ owner candidates / retrieval terms → explicit Owner decision.

## Production audit (2026-10-13)

The following rows are legacy-only and have no current runtime reader after
the runtime cutover:

| object | rows |
| --- | ---: |
| `collection_capture_outbox` | 214 |
| `collection_post_workflows` | 473 |
| `collection_post_analysis` | 470 |
| `collection_post_search_documents` | 473 |
| `collection_projects` / `collection_topics` / source matches | 8 / 73 / 65 |
| `content_assets` / revisions / evidence links | 3 / 4 / 5 |
| `collection_hermes_cron_leases` | 1 |

The only non-empty references that block removal are legacy identifiers, not
current source evidence:

| retained table | legacy column | non-null rows | safe replacement |
| --- | --- | ---: | --- |
| `collection_capture_requests` | `outbox_event_id` | 139 | Its current capture status, `post_id`, and `source_revision_id` already remain on the request. Remove the obsolete reference. |
| `collection_post_workflows` | `outbox_event_id` | 201 | The whole workflow table is legacy and is removed before the outbox. |

All other discovered FK references have zero non-null values. No operation may
use `CASCADE`.

## Required order for the retirement migration

1. Confirm the deployed server is the runtime-cutover revision and that a new
   capture leaves `collection_capture_requests.outbox_event_id` null.
2. Take a schema/data backup using the Supabase recovery mechanism and record
   the audit counts above in the migration run log.
3. Drop legacy triggers and legacy functions explicitly by signature:
   `initialize_collection_post_workflow`, the three Hermes cron functions,
   `codex_stage_collection_preprocess`, `record_collection_image_analysis`,
   `search_collection_post_documents`, `store_content_draft`, and
   `upsert_collection_post_search_document`.
4. Remove obsolete foreign keys, indexes, and nullable columns from retained
   current tables. In particular, remove `collection_capture_requests.outbox_event_id`
   only after its 139 old values have been cleared; do not alter the request's
   `post_id`, `source_revision_id`, or source-quality state.
5. Drop children before parents: content evidence/revisions before assets;
   topic matches/ideas/scopes before topics and projects; workflows and cron
   leases before outbox; old search documents and analyses independently.
6. Read back: no listed legacy relation/function/trigger remains, capture
   request source-revision links remain intact, and the owner-guided tables
   retain their pre-run counts. Then run the current capture/review/search
   smoke tests.

## Explicit approval point

Step 4 clears 139 legacy identifiers and steps 3–5 permanently drop legacy
objects. It therefore requires a fresh Owner approval immediately before the
migration is run. The deployment of the runtime cutover is a separate approval
because it restarts `media-collection-server`.
