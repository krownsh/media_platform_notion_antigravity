# Owner-guided retrieval metadata — approved design

**Status:** approved design; implementation has not started.  
**Scope:** collection only. No stock tables, services, workers, or front-end paths
are in scope.

## Outcome

Every captured post remains searchable from its source evidence immediately, while
the system also writes useful retrieval clues automatically. These clues make it
easy to find a post from an imperfect memory (a tool name, alternate wording, an
entity, or a short remembered situation) without turning them into accepted
knowledge. Owner acceptance remains the sole promotion boundary for folders,
post-learning notes, Topic knowledge, and Project references.

The result retains the three existing, visible semantic layers:

| Layer | Contents | Owner acceptance required? | Default search? |
| --- | --- | --- | --- |
| Raw evidence | captured post, source payload, comments | No | Yes |
| Retrieval metadata | source terms, entities, aliases, memory cues, post-scoped discussion cues | No; may be hidden later | Yes |
| Formal knowledge | accepted post note, Topic knowledge/link, Project reference | Yes | Yes |
| Semantic candidates | review proposals only | Yes | No; explicit toggle only |

Retrieval metadata is a convenience index, not a candidate decision and not a
claim about what the Owner has accepted. Its UI wording must say exactly that.

## Authoritative records and projections

Add a normalized owner-scoped retrieval ledger. A term stores its display text,
normalized key, kind (`source_keyword`, `entity`, `alias`, `memory_cue`,
`discussion_cue`, or `formal_knowledge`), visibility (`active` or `hidden`), and
bounded evidence. A companion provenance record links that term to one or more
source revisions, post discussion events, or accepted-review records. Both tables
carry `user_id`, timestamps, RLS, and idempotency constraints. The ledger is the
authoritative record; the existing `owner_post_search_documents` row remains a
rebuildable search projection.

The projection gains `retrieval_text` and a corresponding vector/index. The
search RPC searches raw evidence, retrieval text, and formal text by default;
candidate text remains opt-in. A matched result returns only compact, truthful
reason labels (for example `retrieval_alias` or `retrieval_discussion_cue`),
never an opaque confidence score presented as a decision.

The Markdown case file stays a readable local projection. It receives the
meaningful post-scoped discussion/event and its retrieval cues after the database
write succeeds. It must never become the source of truth or a JSON dump.

## Automatic generation without paid background AI

Source capture always derives deterministic terms from title, author, platform,
URL host/path, hashtags, explicit mentions, and safely bounded salient phrases in
the captured text/comments. This is free, immediate, explainable, and works when
no model is configured. A future provider may add richer aliases/memory cues only
through the same retrieval-metadata interface; it must record provenance and be
disabled unless an explicitly configured, no-cost/local provider is available.
No new paid API, scheduler, or autonomous semantic promotion is part of this
design.

An agent working on a specific post may append a structured post-discussion event
and its retrieval clues automatically. General conversation never becomes search
metadata. Accepted knowledge triggers a fresh extraction from the accepted
content, writes `formal_knowledge` retrieval terms, and rebuilds the projection;
it does not reopen or auto-accept anything.

## Front-end contract

Normal Library search includes active retrieval metadata. Each result displays
why it matched: raw source, retrieval clue (with its type), accepted knowledge,
or explicitly included candidate. The post detail shows its active retrieval
clues and their source/event in a compact section. The Owner can hide a clearly
wrong clue; hiding removes it from search without editing raw evidence, accepted
knowledge, or the local case-file history. Candidate visibility remains the
existing explicit toggle and is visually distinct from retrieval clues.

## Existing records and rollout safety

Do not copy the old 473-row `collection_post_search_documents` AI fields directly
into the new ledger: the Owner has judged much of that legacy material unreliable.
Instead, rebuild current owner-guided posts from their current captured source.
Legacy keyword/alias/memory-cue values may be used only when they can be verified
against the same post source; otherwise they are ignored. The migration is
append-only, tenant-scoped, resumable, idempotent, dry-run first, and does not
delete legacy tables, case files, Topics, Projects, or any stock data.

## Explicit non-goals

- No automatic folder, Topic, Project, or learning-note acceptance.
- No bulk migration of old vault prose or old JSON artifacts.
- No required per-post Owner review for automatic retrieval clues.
- No Cloudflare filesystem access, no browser-to-local-disk write, and no paid
  model/service added silently.
