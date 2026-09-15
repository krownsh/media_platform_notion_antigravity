import assert from 'node:assert/strict';
import test from 'node:test';
import { workflowActivityPayload } from '../../server/services/activityAuditService.js';

test('workflow activity payload is deterministic and marks blocked errors', () => {
    const workflow = { id: 'workflow-1', user_id: 'user-1', post_id: 'post-1', outbox_event_id: 'outbox-1', updated_at: '2026-09-15T12:00:00.000Z', stage: 'actions', status: 'blocked', failed_stage: 'actions', last_error: 'needs owner input', attempt_count: 3 };
    const event = workflowActivityPayload(workflow, { eventType: 'workflow_action', summary: '操作已卡關' });
    assert.equal(event.event_key, 'workflow_action:workflow-1:2026-09-15T12:00:00.000Z');
    assert.equal(event.event_result, 'blocked');
    assert.equal(event.error_message, 'needs owner input');
});
