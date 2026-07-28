-- Hotfix 001: qualify PL/pgSQL result-column references in store_content_draft.
-- Run once only when stage_c_content_studio.sql was deployed before this fix.

begin;

create or replace function public.store_content_draft(
    p_user_id uuid,
    p_source_id uuid,
    p_format text,
    p_title text,
    p_body text,
    p_metadata jsonb,
    p_idempotency_key text,
    p_poc_run_id uuid default null
)
returns table (
    content_asset_id uuid,
    content_revision_id uuid,
    revision_number integer,
    created boolean
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_asset_id uuid;
    v_revision_id uuid;
    v_revision_number integer;
begin
    if p_user_id is null or p_source_id is null or coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
        raise exception 'user_id, source_id, title and body are required';
    end if;

    insert into public.content_assets (user_id, source_id, title, format, metadata)
    values (p_user_id, p_source_id, p_title, p_format, coalesce(p_metadata, '{}'::jsonb))
    on conflict (user_id, source_id, format) do nothing
    returning id into v_asset_id;

    if v_asset_id is null then
        select asset.id into v_asset_id
        from public.content_assets as asset
        where asset.user_id = p_user_id
          and asset.source_id = p_source_id
          and asset.format = p_format
        for update;
    end if;

    select revision.id, revision.revision_number into v_revision_id, v_revision_number
    from public.content_revisions as revision
    where revision.content_asset_id = v_asset_id
      and revision.idempotency_key = p_idempotency_key;

    if v_revision_id is not null then
        return query select v_asset_id, v_revision_id, v_revision_number, false;
        return;
    end if;

    update public.content_assets as asset
    set title = p_title,
        metadata = coalesce(p_metadata, '{}'::jsonb),
        updated_at = now()
    where asset.id = v_asset_id;

    select coalesce(max(revision.revision_number), 0) + 1 into v_revision_number
    from public.content_revisions as revision
    where revision.content_asset_id = v_asset_id;

    insert into public.content_revisions (
        user_id, content_asset_id, revision_number, idempotency_key, body, change_summary, author_type
    )
    values (
        p_user_id, v_asset_id, v_revision_number, p_idempotency_key, p_body, 'Generated from outbox route', 'ai'
    )
    returning id into v_revision_id;

    insert into public.content_evidence_links (user_id, content_asset_id, evidence_type, target_id, citation_text)
    values (p_user_id, v_asset_id, 'source_post', p_source_id, 'Original captured source')
    on conflict (content_asset_id, evidence_type, target_id) do nothing;

    if p_poc_run_id is not null then
        insert into public.content_evidence_links (user_id, content_asset_id, evidence_type, target_id, citation_text)
        values (p_user_id, v_asset_id, 'poc_result', p_poc_run_id, 'Validated sandbox POC run')
        on conflict (content_asset_id, evidence_type, target_id) do nothing;
    end if;

    return query select v_asset_id, v_revision_id, v_revision_number, true;
end;
$$;

revoke all on function public.store_content_draft(uuid, uuid, text, text, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.store_content_draft(uuid, uuid, text, text, text, jsonb, text, uuid) to service_role;

commit;
