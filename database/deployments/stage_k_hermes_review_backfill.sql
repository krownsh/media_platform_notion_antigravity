-- Stage K follow-up: old unattended triage pauses are review records.
-- They were never completed and should be picked up by the later decision flow,
-- not mistaken for work for the five-minute preprocess queue.

update public.collection_post_workflows
set stage = 'review',
    context = coalesce(context, '{}'::jsonb)
        || jsonb_build_object(
            'review_request', coalesce(
                context -> 'review_request',
                jsonb_build_object(
                    'reason', 'legacy_strategy_pause',
                    'question', '這篇貼文尚未完成後續處理，請選擇研究、POC、復刻、改寫或只保留書籤。',
                    'options', jsonb_build_array('research', 'poc_proposal', 'replication_plan', 'fast_rewrite', 'bookmark'),
                    'created_at', now()
                )
            )
        ),
    updated_at = now()
where stage = 'strategy'
  and status = 'awaiting_user';
