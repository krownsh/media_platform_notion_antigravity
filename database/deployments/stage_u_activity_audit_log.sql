-- Stage U: immutable, owner-readable activity history for workflow operations.
create table if not exists public.collection_activity_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    post_id uuid references public.collection_posts(id) on delete set null,
    workflow_id uuid references public.collection_post_workflows(id) on delete set null,
    outbox_event_id uuid references public.collection_capture_outbox(id) on delete set null,
    event_type text not null check (event_type in ('workflow_transition', 'workflow_action', 'capture_failure')),
    event_result text not null check (event_result in ('succeeded', 'failed', 'blocked', 'pending')),
    summary text not null check (char_length(summary) between 1 and 500),
    error_code text,
    error_message text check (error_message is null or char_length(error_message) <= 2000),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now()
);

create index if not exists collection_activity_events_user_created_idx
    on public.collection_activity_events (user_id, created_at desc);

create index if not exists collection_activity_events_workflow_created_idx
    on public.collection_activity_events (workflow_id, created_at desc)
    where workflow_id is not null;

alter table public.collection_activity_events enable row level security;

revoke all on table public.collection_activity_events from anon, authenticated;
grant select, insert on table public.collection_activity_events to service_role;
grant select on table public.collection_activity_events to authenticated;

drop policy if exists collection_activity_events_owner_select on public.collection_activity_events;
create policy collection_activity_events_owner_select
    on public.collection_activity_events
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

comment on table public.collection_activity_events is
    'Append-only, user-owned audit events. Write only through service-role workflow/capture services.';
