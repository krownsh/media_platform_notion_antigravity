-- Stage J follow-up: remove an unnecessary index from the singleton lease.
-- The table has exactly one row; the foreign key does not need a covering
-- index, and keeping one would only add an unused shared-database object.

drop index if exists public.collection_hermes_cron_leases_workflow_idx;
