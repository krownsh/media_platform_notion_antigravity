# Legacy Retirement Inventory

## Retirement rule

Legacy components have no role in the owner-guided workflow once a replacement milestone has passed. Retirement is executed in three separate stages:

1. **Freeze** — prohibit new writes and remove the component from all new-source paths.
2. **Hide** — remove normal UI and agent entry points while preserving read-only historical data and an inventory.
3. **Remove** — after dependency readback, backup, and owner confirmation, delete the component and prove its routes/jobs/tables can no longer be used.

Physical removal always requires an approved per-object manifest, backup/checksum, foreign-key/readback verification, and explicit owner confirmation. This policy prevents accidental loss; it does not preserve old product behavior indefinitely.

## Keep or replace

| Legacy/current component | Target disposition | Replacement / reason |
| --- | --- | --- |
| `collection_posts`, media, comments, source metadata | Keep and evolve | Immutable source facts remain the product foundation. |
| Capture request queue and worker | Keep and simplify | Durable capture, quality states, idempotency, retry. |
| Search projection | Replace incrementally | Index raw sources immediately, then formal knowledge. |
| `collection_collections` | Migrate to approved folder taxonomy | Legacy assignments remain historical evidence only. |
| `collection_topics` and source matches | Migrate selectively | New Topics are repository-independent and proposal/acceptance driven. |

## Freeze candidates

| Component | Why it exits the new write path | Required proof before Freeze |
| --- | --- | --- |
| `collection_capture_outbox` | Capture must not automatically begin semantic work. | M1 capture contract and finalization migration. |
| `collection_post_workflows` | One global workflow conflates capture, knowledge, projects, and Vault work. | M2 review-packet/checkpoint domain. |
| Mandatory Vault action | Vault is an optional projection, not completion. | M2 accepted-decision audit path. |
| Hermes Cron semantic preprocessing | New packets are prepared without formal promotion. | M2 proposal domain and job inventory. |
| Auto-created Topics/categories | Formal semantics require Owner acceptance. | M3 promotion tests. |

## Hide candidates

| Component | User-visible change | Required replacement |
| --- | --- | --- |
| Knowledge Space pages and routes | Remove from navigation and normal agent guidance. | Topics + cited Topic knowledge revisions. |
| Legacy Insight / Content Studio / Image Workflow pages | Remove legacy navigation. | Inbox, Library, Topics, Projects. |
| Legacy collection editing controls | Disable new legacy folders/renames/deletes. | Accepted folder taxonomy review. |
| Legacy topic-to-GitHub UI | Remove repository requirement. | Project Catalog and project reference candidates. |

## Remove candidates

| Component | Earliest removal gate | Evidence required |
| --- | --- | --- |
| Knowledge Space schema, services, UI, routes, tests | M6 migration and UI replacement accepted | Dependency inventory, backup, browser/readback proof, owner confirmation. |
| `collection_post_workflows` and workflow services | M6 new review flow covers active use cases | No active references, historical export, SQL/RLS readback, owner confirmation. |
| `collection_capture_outbox` and outbox services | M6 all new capture paths bypass it | New capture E2E, pending-row inventory, backup, owner confirmation. |
| Hermes Cron / dispatch jobs | M6 after active job inventory is zero or exported | Job/PM2 inventory, disabled state, owner confirmation. |
| Vault sync enforcement | M6 after optional export is separately verified | No completion constraint, route removal test, owner confirmation. |

## Known historical data handling

Old sources remain searchable immediately. Old folders, Topics, tags, workflow contexts, and Knowledge Space links are labelled legacy evidence and never auto-promoted. A historical source enters the new review model only from an explicit user action, a search/open event, an accepted relevance proposal, or an Owner-authorized batch. No bulk rewrite is allowed without a manifest and approval.
