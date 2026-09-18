# Live Taxonomy Reconciliation — Read-only Preview

- **Live snapshot:** 2026-09-18 05:45:15 UTC
- **Manifest:** [`2026-09-18-live-taxonomy-manifest.json`](./2026-09-18-live-taxonomy-manifest.json)
- **Mode:** read-only; no database mutation was executed.

## Current live cardinality

| Item | Count |
|---|---:|
| All posts | 430 |
| Assigned posts | 333 |
| Unassigned / Inbox posts | 97 |
| Dangling or cross-owner assignments | 0 |
| Owner-approved collections | 20 |
| Exact Hermes auto collections | 33 |

## Proposed writeback scope

| Operation | Count | Decision |
|---|---:|---|
| Rename existing owner collections | 0 | No explicit Owner `collection ID → new name` mapping exists; no name is inferred. |
| Reassign existing posts | 0 | All exact Hermes auto folders have 0 posts. The 97 unassigned posts remain Inbox because no per-post destination decision exists. |
| Clean up auto-folder records | 33 | Candidate only. Every candidate has the exact Hermes description and an observed same-owner `post_count = 0`. |

## Cleanup candidate fingerprint

```text
algorithm: md5(sorted id|name|post_count, newline-separated)
fingerprint: a3175a2e59ee172a75344865c7be9c41
candidate count: 33
```

The complete ID/name list is in the JSON manifest. The list includes variants such as `AI 工具`, `AI工具`, `AI 工具與應用`, `AI 工具与应用`, and related auto-generated folders. It excludes all 20 Owner-approved collections even where they currently have zero posts.

## Writeback gate — not authorized yet

Before any live mutation:

1. Owner explicitly approves the 33-candidate scope and fingerprint above.
2. Create a backup under `/Volumes/DevSSD/hermes/`.
3. In the same write boundary, repeat the candidate query. Stop if its count, fingerprint, description rule, ownership, or any `post_count` differs.
4. Apply only the approved cleanup action. This preview authorizes **no rename** and **no post reassignment**.
