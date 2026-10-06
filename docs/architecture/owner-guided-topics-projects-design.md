# Owner-Guided Topics and Project Catalog Design

## Decision

M4 uses a new, additive owner-guided domain. It does **not** extend
`collection_topics` or `collection_projects`: those tables encode the legacy
repository-first product model and remain historical evidence until M6.

Three possible approaches were considered:

1. Reuse the legacy Topic/Project tables. Rejected: a Topic would still have
   legacy repository/domain constraints and old automation would remain hard
   to distinguish from new owner-approved records.
2. Create an owner-guided parallel domain. **Chosen:** clear write authority,
   independent Topics, reversible migration, and a concrete M6 retirement
   boundary.
3. Replace legacy tables in place. Rejected: it would silently reinterpret
   historical records and makes rollback/data proof unnecessarily risky.

## Domain and write gates

`owner_topics` is a user-owned identity (`label`, status), independent of any
project. `owner_topic_source_links` records an accepted source-revision link;
`owner_topic_revisions` stores only an owner-accepted knowledge delta and
`owner_topic_revision_citations` makes every revision inspectably cited.

An accepted `topic_knowledge_delta` review proposal is the only way to create
one of these records from a captured source. Its payload contains the topic
labels, an explicit `recorded` or `not_needed` decision, and—in the recorded
case—owner-confirmed synthesis. `not_needed` creates the accepted Topic/source
link but no empty knowledge revision. A candidate marked `needs_discussion`
cannot be promoted.

`owner_project_catalog` supports `local_repository`, `remote_repository`, and
`non_code` entries. It is created/edited explicitly by the Owner; discovery
can only create `project_reference` proposals. Acceptance writes
`owner_topic_project_references`, explaining why a Topic may matter to a
catalogued project, but performs no repository or project mutation.

`owner_poc_proposals` is deliberately separate from review promotion. The
Owner creates a proposal, then performs a second explicit approval. Approval
authorizes only a future isolated workspace specification; it never runs code
or modifies the target project.

## User flow

For a captured source, Focus Mode orders decisions as folder, post learning
note, Topic labels, Topic knowledge delta, then any confident catalog project
references. Each card shows source revision, recommendation, alternatives,
what acceptance writes, and defer/resume. A long source with no owner-written
synthesis surfaces `needs_discussion`; it cannot accidentally become an empty
Topic revision.

Topics page is a living, cited knowledge view: Topic identity, source links,
latest accepted revision, and accepted project references. Projects page is a
small explicit catalog, with reference candidates and separate POC proposals.

## Safety and verification

All new public tables enable RLS, receive explicit Data API grants, and retain
`created_at`/`updated_at`. Browser callers get owner reads only; server-side
service-role RPCs perform promotion. Database tests verify atomic promotion,
optimistic version conflicts, citations, topic independence, owner isolation,
and the no-execution POC boundary. UI and route contracts verify the same
phase/next-action language is shown in Focus Mode.
