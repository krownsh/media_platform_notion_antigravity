# Owner-Guided Library Search Design

## Decision

M5 replaces the legacy mixed search projection for the normal Library path.
The legacy projection combines automatic analysis, workflows, drafts, and
source text, so it cannot honestly say whether a result is raw evidence,
accepted knowledge, or an unaccepted candidate.

The chosen design creates `owner_post_search_documents`, a rebuildable,
owner-scoped projection with separate `raw_text`, `formal_text`, and
`candidate_text` fields. Default search ranks only raw and formal text.
Candidate search is explicit (`include_candidates=true`) and every returned
row includes reason labels such as `raw_source`, `post_learning_note`,
`topic_knowledge`, or `project_reference`.

Alternatives rejected: extending `collection_post_search_documents` would
continue to encode legacy semantics; performing live joins at query time would
make retrieval fragile and slow as cited knowledge grows.

## Indexing and user flow

Capture immediately indexes raw source facts. An accepted folder, note,
Topic revision, or project-reference promotion triggers a non-fatal refresh of
the same post's projection. Projection failure never rolls back an accepted
decision; the maintenance rebuild can repair it.

The Library view offers text search, source-quality/status filters, an
explicit candidate toggle, and a visible "why this matched" label. A result
links to its source post and never displays a candidate as formal knowledge.

## Verification

Database checks cover tenant isolation, raw retrieval, formal enrichment,
candidate exclusion by default, inclusion only with the toggle, reason labels,
RLS, grants, and RPC scope. Service, route, and UI contracts cover the same
semantics; isolated PostgreSQL proves the actual lexical query and promotion
refresh path.
