# Owner-guided preservation baseline — 2026-10-13

Status: recorded from a read-only production audit. This file authorizes no
database mutation, process restart, deployment, archive, or deletion.

## Scope boundary

This baseline covers only the collection database objects and the approved
media-collection Obsidian Vault. It does not inspect, mention as a target, or
authorize changes to stock schemas, stock tables, or stock processes.

## Protected current-workflow evidence

The following production counts are the minimum evidence that must remain
intact before and after every later collection-only migration:

| Current object | Count |
| --- | ---: |
| `collection_posts` | 505 |
| `collection_post_media` | 467 |
| `collection_post_comments` | 1,459 |
| `collection_capture_requests` | 193 |
| `collection_source_revisions` | 510 |
| `owner_review_packets` | 509 |
| `owner_review_proposals` | 83 |
| `owner_review_approvals` | 13 |
| `owner_review_checkpoints` | 509 |
| `owner_review_audit_events` | 809 |
| `owner_local_note_manifests` | 507 |
| `owner_local_note_events` | 525 |
| `owner_post_search_documents` | 505 |
| `owner_candidate_generation_jobs` | 505 |

Vault delivery evidence at the same point: 505 post case files, one Topic
note, and one Project note. All 507 manifests were synchronized.

## Confirmed coverage

- Every current post had an owner search projection and local-note manifest.
- Every current post had a source revision.
- The 19 capture requests created since the source-revision cutover had a
  source revision; only historical requests retained a legacy outbox reference.
- 12 of 13 owner decisions were accepted and must remain auditable; one is an
  explicit rejection and must remain traceable rather than being erased.

## Known integrity repairs — prepared, not applied

1. Source revision `78fa753c-b25f-424b-b8fc-aef0518d0d23` is complete and has
   its source, manifest, and search projection, but no `owner_review_packet`.
   The safe repair is one idempotent packet creation, preserving the existing
   source revision and producing no semantic proposal.
2. The earlier audit candidate
   `7d07cd22-ad21-4086-a71e-7bf646d2cf7d` was rechecked before deployment. It
   is an accepted `not_needed` decision with no Topic payload, so it correctly
   has no `owner_topic_revisions` result. It requires no repair and must not
   be promoted into knowledge.

These are database writes and therefore require a separate immediate Owner
approval before they are applied.

## Legacy retention gate

Old collection workflows, outbox records, old search projections, old Topic/
Project taxonomy, and content drafts are not treated as current formal
knowledge. They remain preserved until all of the following are true:

1. current owner-guided retrieval terms cover the intended remembered-phrase
   and concept search use cases;
2. any historical material chosen for retention has been reviewed or exported
   without auto-promotion;
3. the owner has approved the exact physical-retirement scope immediately
   before execution; and
4. the migration uses only an explicit collection-object allowlist, never
   `CASCADE`, and never any stock object.

The corresponding phased plan is
`docs/operations/legacy-collection-retirement-plan.md`.
