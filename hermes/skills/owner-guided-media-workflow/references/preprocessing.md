# Source capture and preprocessing

## Capture and provenance

Use the existing crawler-only acquisition contract until another integration is explicitly implemented and verified. Do not claim official platform API fallback, tokens or rate-limit protection from historical role descriptions.

Preserve original URL/upload identity, canonical URL, author, time, body, media, relevant comments, extraction method, immutable revision and capture gaps. Inspect links/cards for substantive nested long-form sources such as X Articles. Recursively capture in-scope nested sources, tracking parent-child context, canonical duplicates and cycles; do not expand into unrelated browsing. Retain each child's full retrieved body and provenance. Record no_nested_longform_found, nested_longform_captured, nested_longform_partial or nested_longform_failed where supported. A teaser does not establish its linked article was read.

Stop recursion at completion, duplicate/cycle or recorded failure; if an operational limit is reached, record remaining targets and partial status. Missing required child evidence makes the bundle partial. Later discovery reopens the completeness assessment without destroying old revisions.

For partial sources, dehydrate only retrieved evidence and identify claims that cannot yet be evaluated. Use the current repair gate for persisted semantic proposals; if it requires Owner permission, keep bounded analysis unsaved until permission or backend support exists. Never bypass the gate through direct database writes. A failed request with no source revision remains a failure, not a fabricated material card.

## 脫水 contract

Remove repetition, marketing padding and irrelevant setup. Preserve:
- main claims and whose claims they are;
- evidence, examples and original locators;
- method, reproducible steps, inputs and outputs;
- preconditions, versions, costs stated by the source, limitations and exceptions;
- prompts or code details necessary for reuse;
- missing evidence and uncertainty.

Do not enforce a fixed short word count. Do not invent facts, replace full source snapshots with dewatering, or convert marketing claims into verified results. Distinguish quoted/extracted material, paraphrase and inference. Validate important numbers, negations, conditions and references against source text; valid JSON alone is insufficient.

## Compare before discussion

Retrieve relevant raw sources, accepted knowledge, prior decisions and distinctly labelled AI candidates where access allows. Compare concrete claims, not merely common keywords. Classify repetition, new evidence, support, contradiction, different conditions or unresolved relation. Check versions, dates, task conditions and shared original sources before claiming conflict or independent corroboration. Explain match reasons; report limited retrieval coverage rather than claiming exhaustive search.

## Preparation depth

Every usable source receives a material card: dewatered content, source quality, provenance, knowledge increment, candidate Topic/Project relations, useful question if any, and optional reuse markers.

A priority source receives deeper evidence checks, cross-source comparisons, alternative synthesis proposals, possible decision impact and one useful opening question. Direct agent submission gives processing priority, not higher truth status.

Prioritize novelty, meaningful disagreement, current needs, timeliness and explicit Owner intent. Preserve exploration and future inspiration even without Project matches. Priorities are revisable recommendations; do not discard lower-ranked sources or generate every output format. Respect configured cost/concurrency budgets; if no unattended allowance exists, do not start unbounded paid jobs.

Background work requires an actual worker/scheduler. Save-for-later does not imply the present agent will run indefinitely after the conversation ends.
