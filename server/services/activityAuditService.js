const EVENT_RESULTS = new Set(['succeeded', 'failed', 'blocked', 'pending']);

const compact = (value, length) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, length);

export function workflowActivityPayload(workflow, options = {}) {
    if (!workflow?.id || !workflow?.user_id || !workflow?.updated_at) {
        throw new Error('Workflow id, user_id and updated_at are required for an activity event');
    }
    const result = EVENT_RESULTS.has(workflow.status)
        ? workflow.status
        : 'succeeded';
    const eventType = options.eventType === 'workflow_action' ? 'workflow_action' : 'workflow_transition';
    const summary = compact(options.summary || `工作流已更新：${workflow.stage}／${workflow.status}`, 500);
    if (!summary) throw new Error('Activity summary is required');

    return {
        event_key: `${eventType}:${workflow.id}:${workflow.updated_at}`,
        user_id: workflow.user_id,
        post_id: workflow.post_id || null,
        workflow_id: workflow.id,
        outbox_event_id: workflow.outbox_event_id || null,
        event_type: eventType,
        event_result: result,
        summary,
        error_code: workflow.failed_stage || null,
        error_message: workflow.last_error || null,
        metadata: {
            stage: workflow.stage,
            status: workflow.status,
            attempt_count: Number(workflow.attempt_count || 0)
        }
    };
}

export async function recordWorkflowActivity(workflow, options, supabaseClient) {
    const payload = workflowActivityPayload(workflow, options);
    const { error } = await supabaseClient
        .from('collection_activity_events')
        .upsert(payload, { onConflict: 'event_key', ignoreDuplicates: true });
    if (error) throw new Error(`Activity event write failed: ${error.message}`);
    return payload;
}
