-- Stage O: unattended preprocessing may link existing containers only.
-- Apply after Stage M. This replaces the DB-only path without changing or
-- migrating any existing Collection, Topic, post, or Vault file.

begin;

create or replace function public.codex_stage_collection_preprocess(
    p_workflow_id uuid,
    p_result jsonb,
    p_agent_id text default 'codex:db-preprocess'
)
returns table (
    workflow_id uuid, stage text, status text, target_stage text,
    target_status text, exact_duplicate_id uuid, collection_id uuid, topic_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_workflow public.collection_post_workflows%rowtype;
    v_post public.collection_posts%rowtype;
    v_duplicate public.collection_posts%rowtype;
    v_collection public.collection_collections%rowtype;
    v_topic public.collection_topics%rowtype;
    v_result jsonb := case when jsonb_typeof(coalesce(p_result, '{}'::jsonb)) = 'object' then coalesce(p_result, '{}'::jsonb) else '{}'::jsonb end;
    v_context jsonb;
    v_note_input jsonb;
    v_collection_id uuid;
    v_topic_id uuid;
    v_topic_slug text;
    v_target_stage text;
    v_target_status text;
    v_now timestamptz := now();
begin
    if p_workflow_id is null then raise exception 'workflow id is required'; end if;
    if p_agent_id is null or p_agent_id !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'invalid Codex agent identity';
    end if;

    select * into v_workflow from public.collection_post_workflows where id = p_workflow_id for update;
    if v_workflow.id is null then raise exception 'workflow % was not found', p_workflow_id; end if;
    if v_workflow.stage not in ('base_analysis', 'triage', 'preprocessing')
       or v_workflow.status not in ('pending', 'processing')
       or (v_workflow.status = 'processing' and v_workflow.locked_by is distinct from p_agent_id) then
        raise exception 'workflow % is not ready for Codex preprocessing', p_workflow_id;
    end if;
    select * into v_post from public.collection_posts where id = v_workflow.post_id and user_id = v_workflow.user_id for update;
    if v_post.id is null then raise exception 'workflow % has no source post', p_workflow_id; end if;

    update public.collection_posts
       set canonical_url = nullif(regexp_replace(lower(btrim(original_url)), '/+$', ''), ''),
           content_hash = nullif(md5(regexp_replace(lower(btrim(coalesce(content, ''))), '\\s+', ' ', 'g')), md5('')),
           updated_at = v_now
     where id = v_post.id;
    select * into v_duplicate from public.collection_posts
     where user_id = v_post.user_id and id <> v_post.id
       and canonical_url is not null and canonical_url = nullif(regexp_replace(lower(btrim(v_post.original_url)), '/+$', ''), '')
     order by created_at asc limit 1;

    -- An explicit ID must belong to the workflow tenant. A duplicate may
    -- safely inherit its already-established collection. Free text is stored
    -- below as a suggestion and is never materialized as a Collection.
    if (v_result #>> '{folder,collection_id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        v_collection_id := (v_result #>> '{folder,collection_id}')::uuid;
    elsif v_duplicate.collection_id is not null then
        v_collection_id := v_duplicate.collection_id;
    end if;
    if v_collection_id is not null then
        select * into v_collection from public.collection_collections where id = v_collection_id and user_id = v_post.user_id;
        if v_collection.id is not null then
            update public.collection_posts set collection_id = v_collection.id, updated_at = v_now where id = v_post.id;
        end if;
    end if;

    -- Existing topic ID/slug only. There is intentionally no insert into
    -- collection_topics from unattended preprocessing.
    if (v_result #>> '{topic,topic_id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        v_topic_id := (v_result #>> '{topic,topic_id}')::uuid;
        select * into v_topic from public.collection_topics where id = v_topic_id and user_id = v_post.user_id and status = 'active';
    else
        v_topic_slug := left(nullif(btrim(v_result #>> '{topic,slug}'), ''), 120);
        if v_topic_slug is not null then
            select * into v_topic from public.collection_topics where user_id = v_post.user_id and slug = v_topic_slug and status = 'active';
        end if;
    end if;
    if v_topic.id is not null then
        insert into public.collection_topic_source_matches (user_id, topic_id, source_id, match_type, score, rationale, matched_terms, matched_by, status)
        values (v_post.user_id, v_topic.id, v_post.id,
            case when v_result #>> '{relation,kind}' in ('duplicate','supports','extends','contradicts','related') then v_result #>> '{relation,kind}' else 'related' end,
            least(100, greatest(0, round(coalesce(nullif(v_result #>> '{relation,confidence}', '')::numeric, 0) * 100))),
            left(coalesce(nullif(v_result #>> '{relation,rationale}', ''), 'Codex link-only topic assignment'), 4000),
            coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(v_result #> '{topic,keywords}') = 'array' then v_result #> '{topic,keywords}' else '[]'::jsonb end)), '{}'::text[]),
            'agent', 'suggested')
        on conflict (topic_id, source_id) do update set score = excluded.score, rationale = excluded.rationale, updated_at = v_now;
    end if;

    v_target_stage := case when v_result #>> '{automation,outcome}' = 'research_pending' then 'research' when v_result #>> '{automation,outcome}' = 'complete' then 'complete' else 'review' end;
    v_target_status := case when v_target_stage = 'research' then 'pending' when v_target_stage = 'complete' then 'completed' else 'awaiting_user' end;
    v_note_input := jsonb_build_object(
        'note_title', coalesce(nullif(v_result #>> '{folder,note_title}', ''), v_post.title, 'post-' || left(v_post.id::text, 8)),
        'summary', coalesce(v_result #>> '{analysis,summary}', ''),
        'primary_category', coalesce(v_result #>> '{analysis,primary_category}', 'other'),
        'source_url', v_post.original_url
    );
    v_context := coalesce(v_workflow.context, '{}'::jsonb) || jsonb_build_object(
        'preprocess', v_result,
        'classification_suggestions', jsonb_build_object(
            'folder', case when v_collection.id is null then jsonb_build_object('suggested_name', nullif(coalesce(v_result #>> '{folder,suggested_name}', v_result #>> '{folder,domain}'), ''), 'confidence', coalesce(v_result #> '{folder,confidence}', 'null'::jsonb)) else null end,
            'topic', case when v_topic.id is null then jsonb_build_object('suggested_title', nullif(coalesce(v_result #>> '{topic,suggested_title}', v_result #>> '{topic,title}'), ''), 'confidence', coalesce(v_result #> '{topic,confidence}', 'null'::jsonb)) else null end
        ),
        'folder_persistence', jsonb_build_object('assigned', v_collection.id is not null, 'collection_id', v_collection.id, 'reason', case when v_collection.id is null then 'no_existing_collection' else null end),
        'topic_persistence', jsonb_build_object('topic_id', v_topic.id, 'matched', v_topic.id is not null, 'reason', case when v_topic.id is null then 'no_existing_topic' else null end),
        'vault', jsonb_build_object('status', 'pending', 'relative_path', null),
        'vault_sync', jsonb_build_object('status', 'pending', 'target_stage', v_target_stage, 'target_status', v_target_status, 'note_input', v_note_input, 'queued_at', v_now)
    );
    update public.collection_post_workflows set stage = 'vault_sync', status = 'pending', context = v_context,
        action_plan = jsonb_build_object('schema_version', 2, 'actions', jsonb_build_array(jsonb_build_object('type','vault_note','status','pending','requested_by',p_agent_id,'requested_at',v_now))),
        available_at = v_now, locked_at = null, locked_by = null, failed_stage = null, last_error = null, completed_at = null, updated_at = v_now
      where id = v_workflow.id;
    return query select v_workflow.id, 'vault_sync'::text, 'pending'::text, v_target_stage, v_target_status, v_duplicate.id, v_collection.id, v_topic.id;
end;
$$;

comment on function public.codex_stage_collection_preprocess(uuid, jsonb, text) is
    'DB-only preprocess: links tenant-owned containers only; suggestions stay in workflow.context.classification_suggestions.';
revoke all on function public.codex_stage_collection_preprocess(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.codex_stage_collection_preprocess(uuid, jsonb, text) to service_role;

commit;
