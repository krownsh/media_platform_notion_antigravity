# Post workflow deployment

Apply `database/deployments/stage_g_post_workflow.sql` after Stages B, D, D.1, E, and F.
It adds the user-visible `collection_post_workflows` lifecycle and analysis
provenance fields. It is a deployment source file, not a record in Supabase
migration history; generate and review the formal migration before applying it
to a shared environment.

Legacy sources are deliberately backfilled as actionable work: an old outbox
row with `sent` proves only technical delivery, not that a user discussed,
researched, tested, or completed the post. URL sources enter triage; legacy
images enter base analysis.

After Stage G is deployed, restart the existing PM2 processes:

```bash
pm2 restart media-collection-server
pm2 restart media-collection-capture-worker
```

The Capture Worker stays permanently running. It is not a scheduled job:
uploads are claimed as soon as they are available. Hermes is scheduled or used
interactively through `my-mediacrawl-skill`.

The browser shows post workflow state via `/api/posts`; it refreshes while a
user is signed in so Hermes updates appear without a manual reload.
