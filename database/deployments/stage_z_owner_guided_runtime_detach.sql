-- Owner-guided runtime detachment (M2, non-destructive).
--
-- This migration changes only the collection capture-completion entry point.
-- It does not delete, update, archive, or query any legacy rows, and it does
-- not reference stock schemas or stock tables. The older completion function
-- and nullable legacy columns remain temporarily for the separately approved
-- physical-retirement migration.

begin;

create or replace function public.complete_owner_guided_capture_request(
    p_request_id uuid,
    p_worker_id text,
    p_status text,
    p_capture_quality text,
    p_post_id uuid,
    p_source_revision_id uuid
)
returns public.collection_capture_requests
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_request public.collection_capture_requests;
begin
    if p_status <> 'finalized' then
        raise exception 'p_status must be finalized for owner-guided capture' using errcode = '22023';
    end if;
    if p_capture_quality not in ('complete', 'partial') then
        raise exception 'p_capture_quality must be complete or partial' using errcode = '22023';
    end if;
    if p_post_id is null or p_source_revision_id is null then
        raise exception 'p_post_id and p_source_revision_id are required' using errcode = '22023';
    end if;

    update public.collection_capture_requests request
    set status = p_status,
        capture_quality = p_capture_quality,
        post_id = p_post_id,
        source_revision_id = p_source_revision_id,
        lease_owner = null,
        lease_expires_at = null,
        finalized_at = now(),
        failed_at = null,
        error_code = null,
        error_message = null,
        updated_at = now()
    where request.id = p_request_id
      and request.status = 'extracting'
      and request.lease_owner = p_worker_id
    returning * into v_request;

    if v_request.id is null then
        raise exception 'capture request is not leased by this worker' using errcode = 'P0001';
    end if;
    return v_request;
end;
$$;

revoke all on function public.complete_owner_guided_capture_request(
    uuid, text, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.complete_owner_guided_capture_request(
    uuid, text, text, text, uuid, uuid
) to service_role;

commit;
