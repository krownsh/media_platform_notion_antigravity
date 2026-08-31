-- Stage K follow-up: keep legacy strategy pauses out of the unattended queues.
-- Idempotent so it can reconcile rows created by an older Cron prompt after
-- the initial Stage K backfill was applied.

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
