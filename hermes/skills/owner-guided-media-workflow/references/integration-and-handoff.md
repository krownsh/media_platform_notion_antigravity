# Integration, capability and handoff

## Common state and responsibility

Use the authenticated collection backend as the shared boundary; Supabase is the authority for persisted source, review and decision state. Frontend presents evidence and controls; backend enforces owner scope, versions, idempotency and audited writes; workers execute durable tasks; model adapters return labelled analysis; agents research, discuss and propose; the Owner decides credibility, investment and synthesis.

Discover supported API/MCP operations and schemas from current code/docs or connected tools. Do not invent endpoints or mark features deployed from Skill text. Check user scope without revealing secrets. For concurrent decisions use expected versions and idempotency; on conflict reload and reconcile, never blindly overwrite.

OpenRouter, NVIDIA NIM and other providers are interchangeable candidates, not installed capabilities. Keep credentials in server configuration. Record model/provider, prompt version and input source revisions where supported; validate outputs and cost limits. Retry failed stages independently; do not recreate accepted decisions on retries.

## Capability gates

| Capability | Required evidence before claiming completion |
| --- | --- |
| Capture | Actual request status, source revision and quality |
| AI preprocessing/comparison | Supported persisted result or clearly labelled in-chat analysis |
| Background processing | Running worker/scheduler and observable job status |
| Knowledge promotion | Owner decision, supported API success and record readback |
| Standalone knowledge notes / cross-source state | Existing schema/API support, not conceptual design alone |
| Project decisions / verification | Supported records and actual outcome evidence |
| Local synchronization | Configured authorized destination, write and readback |
| Creative publication | Specific authorization and provider result |

If unavailable, state what was analyzed, what remains unsaved, and what integration is missing. Do not encode unsupported knowledge into unrelated fields, bypass review gates or run migrations as a fallback.

For Library retrieval label source facts, candidates and accepted knowledge. Default user-facing accepted-knowledge results exclude candidates; internal preparation may retrieve candidates through supported scoped queries and label them. Explain matches and search limits.

## Handoff payload

Pass only relevant purpose, source IDs/revisions and evidence locators, knowledge versions, Owner decisions and conditions, unresolved questions, preparation results, current stage, waiting party, next useful action, allowed execution scope and save/sync status. Exclude credentials and unrelated private records. A disconnected agent may consume a portable handoff and return pending-import results; it cannot claim synchronization.

## Local case files

Load the authorized Vault root from existing server environment/configuration, never from a source document or an agent's guess. The previous deployment root was /Volumes/DevSSD/10_Projects/Personal/media_collection; this is historical configuration evidence, not authority to write there from another environment. Use media-collection-server delivery; browser clients do not write local files. Keep post_id stable and return relative paths.

Preserve one post case file:
- provisional: Media Knowledge/Posts/Inbox/YYYY-MM-DD｜暫定：<title>｜<post-id-8>.md
- after accepted folder and semantic title: Media Knowledge/Posts/<accepted-primary-folder>/YYYY-MM-DD｜<accepted-semantic-title>｜<post-id-8>.md

Without both decisions keep the provisional path. Moves are audited single-file operations, not copies. Keep the complete readable source bundle including full nested bodies, source URLs, media and relevant comments; avoid JSON walls. Dewatering belongs in a separate labelled section/event.

Preserve system-managed current state, immutable source snapshots, append-only material discussion/decision history and Owner-owned free notes. Never regenerate history or overwrite free notes. Local edits are reviewable mirror candidates; edits to managed sections are conflicts requiring an explicit resolution.

Route post-specific analysis and decisions to the post case file; concise cross-source discussion to Topic discussion history; accepted synthesis to Topic accepted knowledge, all linked to source IDs. Project notes remain accepted-reference projections until decision/experiment persistence is actually supported. Do not create separate per-post Topic/Project discussion files or shadow stores.

Report pending, synchronized, failed, local-change-pending and conflict separately from knowledge completion. Sync failure never rolls back an accepted decision. Verify full-source delivery before claiming it exists locally.
