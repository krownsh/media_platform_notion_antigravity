-- Physical retirement of the superseded collection workflow.
--
-- Scope is deliberately limited to tables and functions proven unused by the
-- owner-guided runtime. It preserves captured posts and their evidence,
-- owner review/knowledge records, selectable folders, annotations, local-note
-- manifests, and every non-collection schema (including stock).
--
-- This migration never uses CASCADE. Any unrecognised dependency aborts the
-- migration instead of broadening the deletion scope.

begin;

-- Current capture state no longer uses the historic outbox identity.
alter table public.collection_capture_requests
  drop constraint if exists collection_capture_requests_outbox_event_id_fkey;
alter table public.collection_capture_requests
  drop column if exists outbox_event_id;

-- New local case files are keyed by post and source revision, not old workflow.
alter table public.owner_local_note_manifests
  drop constraint if exists owner_local_note_manifests_workflow_id_fkey;
alter table public.owner_local_note_manifests
  drop column if exists workflow_id;

-- Keep the active owner-library audit table, but remove retired link fields.
alter table public.collection_activity_events
  drop constraint if exists collection_activity_events_workflow_id_fkey;
alter table public.collection_activity_events
  drop constraint if exists collection_activity_events_outbox_event_id_fkey;
alter table public.collection_activity_events
  drop column if exists workflow_id;
alter table public.collection_activity_events
  drop column if exists outbox_event_id;

-- These routines exist only for the removed Hermes/outbox/old-search path.
drop trigger if exists initialize_collection_post_workflow on public.collection_capture_outbox;
drop function if exists public.claim_collection_hermes_cron_workflow(text, integer, text);
drop function if exists public.heartbeat_collection_hermes_cron_workflow(uuid, text, integer);
drop function if exists public.release_collection_hermes_cron_workflow(uuid, text);
drop function if exists public.codex_stage_collection_preprocess(uuid, jsonb, text);
drop function if exists public.record_collection_image_analysis(uuid, text, jsonb);
drop function if exists public.search_collection_post_documents(uuid, text, integer, text, uuid, text, text);
drop function if exists public.upsert_collection_post_search_document(uuid, uuid, text, text, text, text, uuid, text, text, text, text[], text[], text[], text[]);

-- Drop dependent legacy tables from leaf to root. No current owner-guided
-- table has a foreign key to any table below.
drop table if exists public.collection_hermes_cron_leases;
drop table if exists public.collection_post_workflows;
drop table if exists public.collection_capture_outbox;
drop table if exists public.collection_post_analysis;
drop table if exists public.collection_post_snapshots;
drop table if exists public.collection_post_search_documents;
drop table if exists public.collection_category_configs;
drop table if exists public.collection_collection_post_map;
drop table if exists public.collection_topic_ideas;
drop table if exists public.collection_topic_source_matches;
drop table if exists public.collection_topic_scopes;
drop table if exists public.collection_topic_match_repair_backups;
drop table if exists public.collection_topics;
drop table if exists public.collection_projects;
drop table if exists public.source_post_canonical_classification_audit_events;
drop table if exists public.source_post_canonical_classifications;
drop table if exists public.source_taxonomy_audit_events;
drop table if exists public.source_taxonomy_category_proposals;

-- Dropping the retired tables removes their triggers. Remove their now-orphaned
-- trigger functions explicitly so the old schema cannot be revived by accident.
drop function if exists public.initialize_collection_post_workflow();
drop function if exists public.collection_enforce_agent_topic_match_review();
drop function if exists public.collection_reject_agent_auto_topic();
drop function if exists public.append_source_post_canonical_classification_audit();
drop function if exists public.enforce_source_post_canonical_classification_owner();
drop function if exists public.prevent_source_post_canonical_classification_audit_mutation();
drop function if exists public.append_taxonomy_proposal_audit();
drop function if exists public.enforce_taxonomy_proposal_owner();
drop function if exists public.prevent_taxonomy_audit_mutation();

commit;
