-- Stage K: unattended Hermes preprocessing and deferred review/research queues.
--
-- The five-minute Cron never asks the user a question. It claims only
-- preprocess work, persists its result, and releases the lease. A separate
-- research Cron may claim stage=research; stage=review is reserved for an
-- explicit review/interactive flow.

begin;

alter table public.collection_posts
    add column if not exists canonical_url text,
    add column if not exists content_hash text;

update public.collection_posts
set canonical_url = nullif(regexp_replace(lower(btrim(original_url)), '/+$', ''), '')
where canonical_url is null and nullif(btrim(original_url), '') is not null;

update public.collection_posts
set content_hash = md5(regexp_replace(lower(btrim(content)), '\\s+', ' ', 'g'))
where content_hash is null and nullif(btrim(content), '') is not null;

create index if not exists collection_posts_user_canonical_url_idx
    on public.collection_posts (user_id, canonical_url)
    where canonical_url is not null;
create index if not exists collection_posts_user_content_hash_idx
    on public.collection_posts (user_id, content_hash)
    where content_hash is not null;

comment on column public.collection_posts.canonical_url is
    'Hermes-normalized source URL used for exact duplicate detection.';
comment on column public.collection_posts.content_hash is
    'Normalized content identity used for exact duplicate detection; no embedding is stored.';

alter table public.collection_post_workflows
    drop constraint if exists collection_post_workflows_stage_check;
alter table public.collection_post_workflows
    add constraint collection_post_workflows_stage_check
    check (stage in ('base_analysis', 'triage', 'preprocessing', 'strategy', 'research', 'review', 'actions', 'complete'));

alter table public.collection_topics
    drop constraint if exists collection_topics_origin_check;
alter table public.collection_topics
    add constraint collection_topics_origin_check
    check (origin in ('user', 'agent_proposal', 'agent_auto'));

alter table public.collection_topics
    drop constraint if exists collection_topics_agent_proposal_needs_proposed;
alter table public.collection_topics
    add constraint collection_topics_agent_origin_status
    check (
        (origin = 'agent_proposal' and status = 'proposed')
        or (origin = 'agent_auto' and status = 'active')
        or (origin = 'user' and status in ('active', 'paused', 'archived'))
    );

alter table public.collection_topic_source_matches
    drop constraint if exists collection_topic_source_matches_match_type_check;
alter table public.collection_topic_source_matches
    add constraint collection_topic_source_matches_match_type_check
    check (match_type in ('duplicate', 'supports', 'extends', 'contradicts', 'related'));

drop function if exists public.claim_collection_hermes_cron_workflow(text, integer);

create or replace function public.claim_collection_hermes_cron_workflow(
    p_agent_id text,
    p_lease_seconds integer default 1800,
    p_queue text default 'preprocess'
)
returns setof public.collection_post_workflows
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    lease public.collection_hermes_cron_leases;
    candidate public.collection_post_workflows;
    claimed public.collection_post_workflows;
    lease_seconds integer := greatest(60, least(coalesce(p_lease_seconds, 1800), 7200));
begin
    if p_agent_id is null or p_agent_id !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'Invalid Hermes Cron agent identity';
    end if;
    if coalesce(p_queue, 'preprocess') not in ('preprocess', 'research') then
        raise exception 'Invalid Hermes Cron queue';
    end if;

    select * into lease
    from public.collection_hermes_cron_leases
    where lease_id = 1
    for update;

    if lease.lease_id is null then
        insert into public.collection_hermes_cron_leases (lease_id)
        values (1)
        returning * into lease;
    end if;

    if lease.lease_expires_at is not null and lease.lease_expires_at > now() then
        return;
    end if;

    if lease.workflow_id is not null then
        update public.collection_post_workflows
        set status = 'failed',
            failed_stage = stage,
            last_error = left(coalesce(last_error, 'Hermes Cron lease expired before completion'), 4000),
            available_at = now(),
            locked_at = null,
            locked_by = null,
            updated_at = now()
        where id = lease.workflow_id
          and status = 'processing'
          and locked_by = lease.locked_by;
    end if;

    update public.collection_hermes_cron_leases
    set workflow_id = null,
        locked_by = null,
        locked_at = null,
        lease_expires_at = null,
        updated_at = now()
    where lease_id = 1;

    select workflow.* into candidate
    from public.collection_post_workflows workflow
    where workflow.status in ('pending', 'failed')
      and workflow.available_at <= now()
      and workflow.attempt_count < workflow.max_attempts
      and (workflow.locked_at is null
           or workflow.locked_at <= now() - make_interval(secs => lease_seconds))
      and (
          (coalesce(p_queue, 'preprocess') = 'preprocess'
           and workflow.stage in ('base_analysis', 'triage', 'preprocessing'))
          or
          (coalesce(p_queue, 'preprocess') = 'research'
           and workflow.stage = 'research')
      )
    order by
        case when workflow.status = 'failed' then 0 else 1 end,
        workflow.available_at asc,
        workflow.created_at asc
    for update skip locked
    limit 1;

    if candidate.id is null then
        return;
    end if;

    update public.collection_post_workflows
    set status = 'processing',
        attempt_count = attempt_count + 1,
        locked_at = now(),
        locked_by = p_agent_id,
        last_error = null,
        updated_at = now()
    where id = candidate.id
    returning * into claimed;

    update public.collection_hermes_cron_leases
    set workflow_id = claimed.id,
        locked_by = p_agent_id,
        locked_at = now(),
        lease_expires_at = now() + make_interval(secs => lease_seconds),
        updated_at = now()
    where lease_id = 1;

    return next claimed;
    return;
end;
$$;

revoke all on function public.claim_collection_hermes_cron_workflow(text, integer, text)
    from public, anon, authenticated;
grant execute on function public.claim_collection_hermes_cron_workflow(text, integer, text)
    to service_role;

commit;
