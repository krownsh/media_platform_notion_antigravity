-- Stage M.2: normalize legacy capture summaries before Vault sync.
-- Some historical capture rows stored the model's JSON response as text in
-- collection_post_analysis.summary. Keep only the human-readable insight and
-- key points in the UI/Vault contract; malformed legacy text is left intact
-- for review instead of being guessed.

begin;

do $cleanup$
declare
    rec record;
    v_json jsonb;
    v_clean text;
    v_points text;
begin
    for rec in
        select pa.id, pa.post_id, pa.user_id, pa.summary
        from public.collection_post_analysis pa
        join public.collection_post_workflows wf
          on wf.post_id = pa.post_id and wf.user_id = pa.user_id
        where wf.stage = 'vault_sync'
          and wf.status = 'pending'
          and pa.summary like '{%'
    loop
        begin
            v_json := rec.summary::jsonb;
            if jsonb_typeof(v_json) = 'object'
               and nullif(btrim(v_json ->> 'core_insight'), '') is not null then
                select string_agg('• ' || value, E'\n') into v_points
                from jsonb_array_elements_text(
                    case when jsonb_typeof(v_json -> 'key_points') = 'array'
                         then v_json -> 'key_points'
                         else '[]'::jsonb end
                ) item(value);
                v_clean := left(
                    v_json ->> 'core_insight'
                    || case when v_points is null then '' else E'\n' || v_points end,
                    12_000
                );

                update public.collection_post_analysis
                set summary = v_clean,
                    analysis_source = 'codex_db_preprocess',
                    updated_at = now()
                where id = rec.id;

                update public.collection_post_workflows wf
                set context = jsonb_set(
                        jsonb_set(
                            wf.context,
                            '{preprocess,analysis,summary}',
                            to_jsonb(v_clean),
                            true
                        ),
                        '{vault_sync,note_input,summary}',
                        to_jsonb(v_clean),
                        true
                    ),
                    updated_at = now()
                where wf.post_id = rec.post_id
                  and wf.user_id = rec.user_id
                  and wf.stage = 'vault_sync'
                  and wf.status = 'pending';
            end if;
        exception when others then
            -- Leave malformed legacy text untouched for later review.
            null;
        end;
    end loop;
end
$cleanup$;

commit;
