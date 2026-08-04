-- Stage G: durable post workflow state.
--
-- This deployment separates technical outbox delivery from the user-visible
-- lifecycle of a captured post. Apply after Stages B, D, D.1, E, and F.
--
-- Deployment source only. Generate the formal Supabase migration before
-- applying to production.

begin;

alter table public.collection_post_analysis
    add column if not exists analysis_status text not null default 'completed'
        check (analysis_status in ('pending', 'completed', 'failed')),
    add column if not exists analysis_source text,
    add column if not exists analyzed_at timestamptz;

comment on column public.collection_post_analysis.analysis_status is
    'State of the source-level analysis only: pending, completed, or failed. It is not the Hermes workflow state.';
comment on column public.collection_post_analysis.analysis_source is
    'Origin of the current analysis, for example capture_ai, hermes_image, fallback, or legacy.';

update public.collection_post_analysis
set analysis_source = 'legacy',
    analyzed_at = coalesce(analyzed_at, updated_at, created_at)
where analysis_source is null;

create table if not exists public.collection_post_workflows (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    post_id uuid not null references public.collection_posts(id) on delete cascade,
    outbox_event_id uuid references public.collection_capture_outbox(id) on delete set null,
    source_type text not null check (source_type in ('url_capture', 'image_upload')),
    stage text not null check (stage in ('base_analysis', 'triage', 'strategy', 'actions', 'complete')),
    status text not null check (status in ('pending', 'processing', 'awaiting_user', 'completed', 'failed', 'blocked')),
    context jsonb not null default '{}'::jsonb,
    action_plan jsonb not null default '{"schema_version":1,"actions":[]}'::jsonb,
    attempt_count integer not null default 0 check (attempt_count >= 0),
    max_attempts integer not null default 3 check (max_attempts between 1 and 10),
    available_at timestamptz not null default now(),
    locked_at timestamptz,
    locked_by text,
    failed_stage text,
    last_error text,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint collection_post_workflows_post_unique unique (post_id),
    constraint collection_post_workflows_outbox_unique unique (outbox_event_id)
);

comment on table public.collection_post_workflows is
    'User-visible, resumable post lifecycle. stage identifies the work phase; status identifies the state within that phase. context JSONB stores bounded capture/triage metadata; action_plan JSONB stores per-post, user-approved actions and their outcomes.';
comment on column public.collection_post_workflows.context is
    'Bounded workflow context: base_analysis {status, source, errors[]}, triage {summary, category, folder_suggestions[]}, and provenance. Never store credentials or raw private media.';
comment on column public.collection_post_workflows.action_plan is
    'Per-post action plan: {schema_version:1, actions:[{type:research|poc_proposal|poc_execute|fast_rewrite|content_synthesis, status, requested_by, outcome}]}.';

create index if not exists collection_post_workflows_next_idx
    on public.collection_post_workflows (user_id, available_at, created_at desc)
    where status in ('pending', 'failed');
create index if not exists collection_post_workflows_post_idx
    on public.collection_post_workflows (post_id);

alter table public.collection_post_workflows enable row level security;

drop trigger if exists update_collection_post_workflows_updated_at on public.collection_post_workflows;
create trigger update_collection_post_workflows_updated_at
    before update on public.collection_post_workflows
    for each row execute procedure public.collection_update_updated_at_column();

create or replace function public.initialize_collection_post_workflow()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_source_type text;
    v_stage text;
    v_status text;
begin
    if new.aggregate_type <> 'collection_post' or new.event_type <> 'source.ingested.v1' then
        return new;
    end if;

    v_source_type := coalesce(nullif(new.payload ->> 'source_type', ''), 'url_capture');
    if v_source_type not in ('url_capture', 'image_upload') then
        v_source_type := 'url_capture';
    end if;
    v_stage := case when v_source_type = 'image_upload' then 'base_analysis' else 'triage' end;
    -- Outbox delivery is technical only. A newly inserted event must never
    -- become user-workflow complete merely because its delivery status is sent.
    v_status := case when new.status = 'failed' then 'failed' else 'pending' end;

    insert into public.collection_post_workflows (
        user_id, post_id, outbox_event_id, source_type, stage, status, context,
        failed_stage, last_error, completed_at
    ) values (
        new.user_id,
        new.aggregate_id,
        new.id,
        v_source_type,
        v_stage,
        v_status,
        jsonb_build_object(
            'schema_version', 1,
            'capture', jsonb_build_object(
                'correlation_id', new.correlation_id,
                'quality', new.payload ->> 'capture_quality',
                'pipeline_version', new.payload ->> 'pipeline_version'
            ),
            'base_analysis', jsonb_build_object(
                'status', case when v_source_type = 'image_upload' then 'pending' else 'completed' end,
                'source', case when v_source_type = 'image_upload' then 'hermes_image' else 'capture_ai' end
            )
        ),
        case when new.status = 'failed' then 'capture' else null end,
        new.last_error,
        null
    )
    on conflict (post_id) do update
    set outbox_event_id = excluded.outbox_event_id,
        source_type = excluded.source_type,
        context = collection_post_workflows.context || jsonb_build_object('capture', excluded.context -> 'capture'),
        updated_at = now();

    update public.collection_post_analysis analysis
    set analysis_status = case when v_source_type = 'image_upload' then 'pending' else analysis.analysis_status end,
        analysis_source = case
            when v_source_type = 'image_upload' then 'hermes_image'
            when analysis.analysis_source is null then 'capture_ai'
            else analysis.analysis_source
        end,
        analyzed_at = case
            when v_source_type = 'image_upload' then null
            when analysis.analyzed_at is null then now()
            else analysis.analyzed_at
        end,
        updated_at = now()
    where analysis.post_id = new.aggregate_id and analysis.user_id = new.user_id;

    return new;
end;
$$;

drop trigger if exists initialize_collection_post_workflow on public.collection_capture_outbox;
create trigger initialize_collection_post_workflow
    after insert on public.collection_capture_outbox
    for each row execute procedure public.initialize_collection_post_workflow();

-- Legacy `sent` only proves that the old technical delivery completed. It did
-- not contain a per-post strategy decision, so it must remain actionable.
insert into public.collection_post_workflows (
    user_id, post_id, outbox_event_id, source_type, stage, status, context,
    failed_stage, last_error, completed_at
)
select
    outbox.user_id,
    outbox.aggregate_id,
    outbox.id,
    case when outbox.payload ->> 'source_type' = 'image_upload' then 'image_upload' else 'url_capture' end,
    case when outbox.payload ->> 'source_type' = 'image_upload' then 'base_analysis' else 'triage' end,
    case
        when outbox.status = 'failed' then 'failed'
        else 'pending'
    end,
    jsonb_build_object('schema_version', 1, 'legacy_outbox_status', outbox.status),
    case when outbox.status = 'failed' then 'legacy_outbox' else null end,
    outbox.last_error,
    null
from public.collection_capture_outbox outbox
where outbox.aggregate_type = 'collection_post'
  and outbox.event_type = 'source.ingested.v1'
on conflict (post_id) do nothing;

alter table public.collection_topic_scopes
    add column if not exists preferred_actions text[] not null default '{}'::text[],
    add column if not exists auto_execute_actions text[] not null default '{}'::text[];

comment on column public.collection_topic_scopes.preferred_actions is
    'Optional folder context only. Supported values include research, poc_proposal, fast_rewrite, and content_synthesis. It never authorizes an action by itself.';
comment on column public.collection_topic_scopes.auto_execute_actions is
    'Explicit unattended automation opt-in. Defaults empty; project changes, POC execution, and publishing are never allowed values.';

revoke all on table public.collection_post_workflows from public, anon, authenticated;
grant select, insert, update on table public.collection_post_workflows to service_role;

revoke all on function public.initialize_collection_post_workflow() from public, anon, authenticated;
grant execute on function public.initialize_collection_post_workflow() to service_role;

commit;
