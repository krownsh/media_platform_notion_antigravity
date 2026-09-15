-- Stage U.1: make audit event writes idempotent across retried workflow requests.
alter table public.collection_activity_events
    add column if not exists event_key text;

-- The table is newly introduced by Stage U. This default safely covers a deployment
-- where an event was inserted between the two migrations.
update public.collection_activity_events
set event_key = 'legacy:' || id::text
where event_key is null;

alter table public.collection_activity_events
    alter column event_key set not null;

create unique index if not exists collection_activity_events_event_key_uidx
    on public.collection_activity_events (event_key);

comment on column public.collection_activity_events.event_key is
    'Deterministic service-generated idempotency key; prevents duplicate activity events after a retry.';
