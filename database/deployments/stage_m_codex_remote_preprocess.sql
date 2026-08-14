-- Stage M: Codex/Supabase-only preprocessing.
--
-- This RPC is deliberately separate from the Mac Vault bridge.  Codex (or a
-- future remote executor) can persist the analysis, exact-duplicate identity,
-- topic and collection decisions in one transaction, then park the workflow
-- in vault_sync/pending.  Only the local Hermes agent may complete the final
-- Markdown write and move the workflow to its recorded target.

begin;

create or replace function public.codex_stage_collection_preprocess(
    p_workflow_id uuid,
    p_result jsonb,
    p_agent_id text default 'codex:db-preprocess'
)
returns table (
    workflow_id uuid,
    stage text,
    status text,
    target_stage text,
    target_status text,
    exact_duplicate_id uuid,
    collection_id uuid,
    topic_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_workflow public.collection_post_workflows%rowtype;
    v_post public.collection_posts%rowtype;
    v_analysis public.collection_post_analysis%rowtype;
    v_duplicate public.collection_posts%rowtype;
    v_collection public.collection_collections%rowtype;
    v_topic public.collection_topics%rowtype;
    v_result jsonb := case when jsonb_typeof(coalesce(p_result, '{}'::jsonb)) = 'object' then coalesce(p_result, '{}'::jsonb) else '{}'::jsonb end;
    v_analysis_input jsonb := case when jsonb_typeof(v_result -> 'analysis') = 'object' then v_result -> 'analysis' else '{}'::jsonb end;
    v_folder_input jsonb := case when jsonb_typeof(v_result -> 'folder') = 'object' then v_result -> 'folder' else '{}'::jsonb end;
    v_topic_input jsonb := case when jsonb_typeof(v_result -> 'topic') = 'object' then v_result -> 'topic' else '{}'::jsonb end;
    v_relation_input jsonb := case when jsonb_typeof(v_result -> 'relation') = 'object' then v_result -> 'relation' else '{}'::jsonb end;
    v_research_input jsonb := case when jsonb_typeof(v_result -> 'research') = 'object' then v_result -> 'research' else '{}'::jsonb end;
    v_poc_input jsonb := case when jsonb_typeof(v_result -> 'poc') = 'object' then v_result -> 'poc' else '{}'::jsonb end;
    v_note_input jsonb;
    v_context jsonb;
    v_action_plan jsonb;
    v_canonical_url text;
    v_content_hash text;
    v_domain text;
    v_topic_slug text;
    v_topic_title text;
    v_requested_outcome text;
    v_target_stage text;
    v_target_status text;
    v_reason text;
    v_risk_level text;
    v_source_url text;
    v_confidence numeric := 0;
    v_topic_confidence numeric := 0;
    v_relation_score numeric := 0;
    v_network_required boolean := lower(coalesce(v_poc_input ->> 'network_required', v_poc_input ->> 'requires_network', 'false')) = 'true';
    v_secrets_required boolean := lower(coalesce(v_poc_input ->> 'secrets_required', v_poc_input ->> 'requires_secrets', 'false')) = 'true';
    v_execute_requested boolean := lower(coalesce(v_poc_input ->> 'auto_execute', v_poc_input ->> 'execute_requested', v_poc_input ->> 'execution_requested', 'false')) = 'true';
    v_keywords text[] := '{}'::text[];
    v_tags text[] := '{}'::text[];
    v_topics text[] := '{}'::text[];
    v_match_type text;
    v_now timestamptz := now();
begin
    if p_workflow_id is null then
        raise exception 'workflow id is required';
    end if;
    if p_agent_id is null or p_agent_id !~ '^[a-zA-Z0-9._:@/-]{1,128}$' then
        raise exception 'invalid Codex agent identity';
    end if;

    select * into v_workflow
    from public.collection_post_workflows
    where id = p_workflow_id
    for update;

    if v_workflow.id is null then
        raise exception 'workflow % was not found', p_workflow_id;
    end if;
    if v_workflow.stage not in ('base_analysis', 'triage', 'preprocessing')
        or v_workflow.status not in ('pending', 'processing')
        or (v_workflow.status = 'processing' and v_workflow.locked_by is distinct from p_agent_id) then
        raise exception 'workflow % is not ready for Codex preprocessing (%/%, locked_by=%)',
            p_workflow_id, v_workflow.stage, v_workflow.status, v_workflow.locked_by;
    end if;

    select * into v_post
    from public.collection_posts
    where id = v_workflow.post_id and user_id = v_workflow.user_id
    for update;
    if v_post.id is null then
        raise exception 'workflow % has no source post', p_workflow_id;
    end if;

    -- Keep the identity keys deterministic and embedding-free.
    v_canonical_url := nullif(regexp_replace(lower(btrim(v_post.original_url)), '/+$', ''), '');
    v_content_hash := nullif(md5(regexp_replace(lower(btrim(coalesce(v_post.content, ''))), '\s+', ' ', 'g')), md5(''));
    update public.collection_posts
    set canonical_url = v_canonical_url,
        content_hash = v_content_hash,
        updated_at = v_now
    where id = v_post.id;

    select duplicate.* into v_duplicate
    from public.collection_posts duplicate
    where duplicate.user_id = v_post.user_id
      and duplicate.id <> v_post.id
      and (
          (v_canonical_url is not null and duplicate.canonical_url = v_canonical_url)
          or (v_post.platform_post_id is not null
              and duplicate.platform = v_post.platform
              and duplicate.platform_post_id = v_post.platform_post_id)
          or (v_content_hash is not null and duplicate.content_hash = v_content_hash)
      )
    order by case
        when v_canonical_url is not null and duplicate.canonical_url = v_canonical_url then 1
        when v_post.platform_post_id is not null and duplicate.platform_post_id = v_post.platform_post_id then 2
        else 3
    end, duplicate.created_at asc
    limit 1;

    -- Persist the source-level analysis for the web UI and later Vault reads.
    select * into v_analysis
    from public.collection_post_analysis
    where post_id = v_post.id and user_id = v_post.user_id
    order by updated_at desc nulls last, created_at desc nulls last
    limit 1
    for update;

    select coalesce(array_agg(value), '{}'::text[]) into v_tags
    from jsonb_array_elements_text(case when jsonb_typeof(v_analysis_input -> 'tags') = 'array' then v_analysis_input -> 'tags' else '[]'::jsonb end) item(value);
    select coalesce(array_agg(value), '{}'::text[]) into v_topics
    from jsonb_array_elements_text(case when jsonb_typeof(v_analysis_input -> 'topics') = 'array' then v_analysis_input -> 'topics' else '[]'::jsonb end) item(value);

    if v_analysis.id is null then
        insert into public.collection_post_analysis (
            post_id, user_id, summary, tags, topics, primary_category,
            analysis_status, analysis_source, analyzed_at
        ) values (
            v_post.id,
            v_post.user_id,
            left(nullif(v_analysis_input ->> 'summary', ''), 12000),
            v_tags,
            v_topics,
            left(coalesce(nullif(v_analysis_input ->> 'primary_category', ''), 'other'), 80),
            'completed', 'codex_db_preprocess', v_now
        ) returning * into v_analysis;
    else
        update public.collection_post_analysis
        set summary = left(nullif(v_analysis_input ->> 'summary', ''), 12000),
            tags = v_tags,
            topics = v_topics,
            primary_category = left(coalesce(nullif(v_analysis_input ->> 'primary_category', ''), 'other'), 80),
            analysis_status = 'completed',
            analysis_source = 'codex_db_preprocess',
            analyzed_at = v_now,
            updated_at = v_now
        where id = v_analysis.id
        returning * into v_analysis;
    end if;

    -- Match an existing topic when the model is confident; otherwise leave the
    -- topic decision in the stored context for a later research/interactive run.
    if (v_topic_input ->> 'confidence') ~ '^[0-9]+(\.[0-9]+)?$' then
        v_topic_confidence := least(1, greatest(0, (v_topic_input ->> 'confidence')::numeric));
    elsif (v_result #>> '{autonomy,confidence,topic}') ~ '^[0-9]+(\.[0-9]+)?$' then
        v_topic_confidence := least(1, greatest(0, (v_result #>> '{autonomy,confidence,topic}')::numeric));
    else
        v_topic_confidence := 0;
    end if;
    v_topic_title := left(nullif(btrim(v_topic_input ->> 'title'), ''), 240);
    v_topic_slug := left(nullif(btrim(v_topic_input ->> 'slug'), ''), 120);
    if v_topic_title is not null and v_topic_confidence >= 0.85 then
        if v_topic_slug is null then
            v_topic_slug := 'hermes-' || left(v_post.id::text, 12);
        end if;
        select * into v_topic
        from public.collection_topics
        where user_id = v_post.user_id and slug = v_topic_slug
        limit 1;
        if v_topic.id is null then
            select coalesce(array_agg(value), '{}'::text[]) into v_keywords
            from jsonb_array_elements_text(case when jsonb_typeof(v_topic_input -> 'keywords') = 'array' then v_topic_input -> 'keywords' else '[]'::jsonb end) item(value);
            insert into public.collection_topics (
                user_id, slug, title, description, purpose, keywords, origin,
                status, agent_confidence, proposal_evidence
            ) values (
                v_post.user_id,
                v_topic_slug,
                v_topic_title,
                left(v_topic_input ->> 'description', 2000),
                left(v_topic_input ->> 'purpose', 2000),
                v_keywords,
                'agent_auto',
                'active',
                round(v_topic_confidence * 100),
                jsonb_build_object('source_ids', jsonb_build_array(v_post.id), 'rationale', left(v_topic_input ->> 'rationale', 4000))
            ) returning * into v_topic;
        end if;
        if v_topic.id is not null then
            v_match_type := case when v_relation_input ->> 'kind' in ('duplicate', 'supports', 'extends', 'contradicts', 'related') then v_relation_input ->> 'kind' else 'related' end;
            if (v_relation_input ->> 'confidence') ~ '^[0-9]+(\.[0-9]+)?$' then
                v_relation_score := least(100, greatest(0, round((v_relation_input ->> 'confidence')::numeric * 100)));
            else
                v_relation_score := round(v_topic_confidence * 100);
            end if;
            select coalesce(array_agg(value), '{}'::text[]) into v_keywords
            from jsonb_array_elements_text(case when jsonb_typeof(v_topic_input -> 'keywords') = 'array' then v_topic_input -> 'keywords' else '[]'::jsonb end) item(value);
            insert into public.collection_topic_source_matches (
                user_id, topic_id, source_id, match_type, score, rationale,
                matched_terms, matched_by, status
            ) values (
                v_post.user_id, v_topic.id, v_post.id, v_match_type, v_relation_score,
                left(coalesce(nullif(v_relation_input ->> 'rationale', ''), v_topic_input ->> 'rationale', 'Codex autonomous topic assignment'), 4000),
                v_keywords, 'agent', case when v_relation_score >= 85 then 'accepted' else 'suggested' end
            )
            on conflict (topic_id, source_id) do update set
                match_type = excluded.match_type,
                score = excluded.score,
                rationale = excluded.rationale,
                matched_terms = excluded.matched_terms,
                matched_by = excluded.matched_by,
                status = excluded.status,
                updated_at = v_now;
        end if;
    end if;

    -- Prefer the duplicate's established collection; otherwise create the
    -- requested domain folder. Low-confidence folder decisions stay unfiled.
    v_domain := left(nullif(btrim(v_folder_input ->> 'domain'), ''), 255);
    if (v_folder_input ->> 'confidence') ~ '^[0-9]+(\.[0-9]+)?$'
       and (v_folder_input ->> 'confidence')::numeric < 0.85 then
        v_domain := '待整理';
    end if;
    if v_duplicate.collection_id is not null then
        select * into v_collection
        from public.collection_collections
        where id = v_duplicate.collection_id and user_id = v_post.user_id;
    elsif v_domain is not null and v_domain <> '待整理' then
        select * into v_collection
        from public.collection_collections
        where user_id = v_post.user_id and name = v_domain
        limit 1;
        if v_collection.id is null then
            insert into public.collection_collections (user_id, name, description)
            values (v_post.user_id, v_domain, 'Hermes 自動建立的媒體分類資料夾')
            returning * into v_collection;
        end if;
    end if;
    if v_collection.id is not null then
        update public.collection_posts
        set collection_id = v_collection.id, updated_at = v_now
        where id = v_post.id;
    end if;

    -- Enforce the autonomy policy server-side; a caller cannot bypass the
    -- low-confidence or explicitly requested network/Secrets POC boundary.
    if (v_result #>> '{autonomy,confidence_floor}') ~ '^[0-9]+(\.[0-9]+)?$' then
        v_confidence := least(1, greatest(0, (v_result #>> '{autonomy,confidence_floor}')::numeric));
    elsif (v_result #>> '{confidence,overall}') ~ '^[0-9]+(\.[0-9]+)?$' then
        v_confidence := least(1, greatest(0, (v_result #>> '{confidence,overall}')::numeric));
    else
        v_confidence := 0;
    end if;
    v_risk_level := lower(coalesce(nullif(v_result #>> '{autonomy,risk_level}', ''), nullif(v_result ->> 'risk_level', ''), 'high'));
    v_requested_outcome := lower(coalesce(nullif(v_result #>> '{autonomy,outcome}', ''), nullif(v_result ->> 'outcome', ''), 'review_pending'));
    if v_risk_level = 'high' then
        v_target_stage := 'review'; v_target_status := 'awaiting_user'; v_reason := 'high_risk_action';
    elsif v_execute_requested and (v_network_required or v_secrets_required) then
        v_target_stage := 'review'; v_target_status := 'awaiting_user'; v_reason := 'high_risk_poc';
    elsif v_confidence < 0.85 then
        v_target_stage := 'review'; v_target_status := 'awaiting_user'; v_reason := 'low_confidence';
    elsif v_requested_outcome = 'research_pending' then
        v_target_stage := 'research'; v_target_status := 'pending'; v_reason := null;
    else
        v_target_stage := 'complete'; v_target_status := 'completed'; v_reason := null;
    end if;

    v_source_url := case when v_post.platform = 'image' then '（圖片上傳，無公開連結）' else v_post.original_url end;
    v_note_input := case when jsonb_typeof(v_result -> 'note_input') = 'object' then v_result -> 'note_input' else '{}'::jsonb end;
    v_note_input := jsonb_build_object(
        'domain', coalesce(nullif(v_note_input ->> 'domain', ''), v_domain, '待整理'),
        'note_title', coalesce(nullif(v_note_input ->> 'note_title', ''), nullif(v_folder_input ->> 'note_title', ''), v_post.title, '貼文-' || left(v_post.id::text, 8)),
        'summary', left(coalesce(nullif(v_note_input ->> 'summary', ''), v_analysis.summary, ''), 12000),
        'original_content', case when v_post.platform = 'image' then coalesce(v_post.content, '') else null end,
        'discussion', coalesce(nullif(v_note_input ->> 'discussion', ''), '自動分類：' || coalesce(v_analysis.primary_category, 'other') || E'\\nExact duplicate：' || case when v_duplicate.id is null then '未發現' else v_duplicate.id::text end),
        'research', coalesce(nullif(v_note_input ->> 'research', ''), case when jsonb_array_length(case when jsonb_typeof(v_research_input -> 'questions') = 'array' then v_research_input -> 'questions' else '[]'::jsonb end) > 0 then '待研究問題：' || (select string_agg('- ' || value, E'\\n') from jsonb_array_elements_text(v_research_input -> 'questions') item(value)) else '' end),
        'poc', coalesce(nullif(v_note_input ->> 'poc', ''), case when v_poc_input <> '{}'::jsonb then '候選：' || coalesce(v_poc_input ->> 'candidate', '未命名') || E'\\n目標：' || coalesce(v_poc_input ->> 'objective', '未提供') else '' end),
        'decision', coalesce(nullif(v_note_input ->> 'decision', ''), case when v_target_stage = 'complete' then 'Codex 依據高信心且低風險規則完成資料庫預處理，等待本地 Vault 同步。' when v_target_stage = 'research' then '預處理完成，等待 Research Cron。' else '預處理完成，等待使用者在後續互動流程決定。' end),
        'next_step', coalesce(nullif(v_note_input ->> 'next_step', ''), case when v_target_stage = 'research' then '交由 Research Cron 優先處理。' when v_target_stage = 'review' then '等待使用者確認：' || coalesce(v_result #>> '{review_request,question}', '請確認下一步處理方式。') else '已完成目前可安全自動完成的工作。' end),
        'primary_category', coalesce(v_analysis.primary_category, 'other'),
        'tags', to_jsonb(coalesce(v_tags, '{}'::text[])),
        'topics', to_jsonb(coalesce(v_topics, '{}'::text[])),
        'source_url', v_source_url
    ) || v_note_input;

    v_context := coalesce(v_workflow.context, '{}'::jsonb) || jsonb_build_object(
        'source_identity', jsonb_build_object('canonical_url', v_canonical_url, 'content_hash', v_content_hash, 'exact_duplicate', case when v_duplicate.id is null then null else jsonb_build_object('id', v_duplicate.id, 'collection_id', v_duplicate.collection_id) end),
        'folder_persistence', jsonb_build_object('assigned', v_collection.id is not null, 'collection_id', v_collection.id, 'name', v_collection.name, 'inherited_from_duplicate', v_duplicate.id),
        'topic_persistence', jsonb_build_object('topic_id', v_topic.id, 'matched', v_topic.id is not null),
        'source_url', v_source_url,
        'automation', jsonb_build_object('queue', case when v_target_stage = 'research' then 'research' else 'none' end, 'outcome', case when v_target_stage = 'complete' then 'complete' when v_target_stage = 'research' then 'research_pending' else 'review_pending' end, 'confidence_floor', v_confidence, 'risk_level', v_risk_level, 'reason', v_reason, 'policy_version', 'preprocess-v1', 'completed_at', v_now),
        'preprocess', v_result,
        'vault', jsonb_build_object('status', 'pending', 'relative_path', null),
        'vault_sync', jsonb_build_object('status', 'pending', 'target_stage', v_target_stage, 'target_status', v_target_status, 'note_input', v_note_input, 'queued_at', v_now)
    );
    if v_reason is not null then
        v_context := jsonb_set(v_context, '{review_request}', coalesce(v_result -> 'review_request', jsonb_build_object('reason', v_reason, 'question', '需要使用者確認下一步處理方式。', 'options', jsonb_build_array('approve', 'skip', 'research_only'))), true);
    end if;

    v_action_plan := jsonb_build_object('schema_version', 2, 'actions', jsonb_build_array(jsonb_build_object(
        'type', 'vault_note', 'status', 'pending', 'requested_by', p_agent_id,
        'requested_at', v_now, 'notes', 'Write the prepared note to the local Claude-Obsidian Vault before finalizing this workflow.'
    )));

    update public.collection_post_workflows
    set stage = 'vault_sync',
        status = 'pending',
        context = v_context,
        action_plan = v_action_plan,
        available_at = v_now,
        locked_at = null,
        locked_by = null,
        failed_stage = null,
        last_error = null,
        completed_at = null,
        updated_at = v_now
    where id = v_workflow.id;

    return query select v_workflow.id, 'vault_sync'::text, 'pending'::text,
        v_target_stage, v_target_status, v_duplicate.id, v_collection.id, v_topic.id;
end;
$$;

comment on function public.codex_stage_collection_preprocess(uuid, jsonb, text) is
    'Atomically persists Codex database-only preprocessing and queues the real local Vault write in vault_sync/pending.';

revoke all on function public.codex_stage_collection_preprocess(uuid, jsonb, text)
    from public, anon, authenticated;
grant execute on function public.codex_stage_collection_preprocess(uuid, jsonb, text)
    to service_role;

commit;
