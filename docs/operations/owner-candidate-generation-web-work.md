# Web Work：Owner-guided candidate generation

This is a **manual, owner-visible Web Work run**, not a server cron and not a
replacement for the Owner discussion. Run it only after the Stage Y deployment
has been applied. It handles at most 20 jobs and stops immediately on a 429.

## Operator contract

1. Claim a run using a fresh `run_key` and `claim_owner_candidate_generation_jobs`.
2. Process claimed rows serially, never more than 20.
3. For each complete source, read only its own `collection_source_revisions`,
   `collection_posts`, `collection_collections`, `owner_topics`, and
   `owner_project_catalog` rows.
4. Write only: candidate proposals, retrieval terms with evidence excerpts,
   and job completion. Never call a promotion/accept endpoint.
5. On HTTP 429 or provider `rate_limit`, call
   `rate_limit_owner_candidate_generation_run`, report the pause time, and stop
   the run immediately. Do not retry any item in that run.
6. Do not read or mutate any table outside the `collection_*` and `owner_*`
   scope. In particular, never inspect or modify stock tables.

## Prompt to paste into Web Work

```text
You are operating the owner-guided media collection candidate run. Use the
connected Supabase project only. Do not touch stock tables or any non-
collection/non-owner data.

Create a fresh opaque run key. Claim at most 20 jobs with:
select * from claim_owner_candidate_generation_jobs(<OWNER_UUID>, <RUN_KEY>, 20);

If no rows return, report that no eligible source needs candidate preparation
and stop. For every claimed job, process serially:

1. Read that job's source revision and post. If its evidence is incomplete,
   do not create semantic candidates; leave it for source repair.
2. Read only the same Owner's folders, formal Topics, and project Catalog.
3. Produce a content-review brief that separates: source facts, a neutral
   reconstruction, inference, limitation/open question, and an evidence map
   for any nested long-form source. Save it as an owner_review_proposals row
   of type content_review_brief with a stable source-revision idempotency key.
4. Produce drafts only for folder_assignment, post_learning_note (which may be
   not_needed), topic_assignment, topic_knowledge_delta, and project_reference.
   Each draft must cite source evidence and say why it is a candidate. Do not
   create a new Topic or Project merely because it was suggested.
5. Create 3–12 retrieval terms only when each term has a short source excerpt.
   Mark them active, explainable, and non-formal. They improve search but are
   not accepted knowledge. Upsert by the owner/post/normalized-term/kind key.
6. Rebuild that post's owner search projection, then complete the job using
   complete_owner_candidate_generation_job. Do not mark content_discussion
   complete: the Owner must discuss or explicitly waive it in a Codex chat.

If any LLM/provider request returns HTTP 429 or a rate_limit condition, call
rate_limit_owner_candidate_generation_run(<OWNER_UUID>, <RUN_KEY>, 3600),
report the blocked-until timestamp and the unprocessed count, then stop
immediately. Never retry during this run.

Finish with a compact ledger: claimed/completed/failed/rate-limited job counts,
proposal count, retrieval-term count, and post IDs only. Never print source
bodies or credentials.
```
