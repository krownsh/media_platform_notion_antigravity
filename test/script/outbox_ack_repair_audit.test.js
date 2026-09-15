import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOutboxAckRepairManifest } from '../../scripts/maintenance/audit-outbox-ack-repair.js';

test('outbox ACK repair manifest is read-only and only proposes exact workflow/event matches', () => {
  const manifest = buildOutboxAckRepairManifest([
    {
      id: 'workflow-match',
      user_id: 'user-1',
      post_id: 'post-1',
      outbox_event_id: 'event-1',
      stage: 'vault_sync',
      status: 'pending',
      collection_capture_outbox: {
        id: 'event-1', user_id: 'user-1', aggregate_id: 'post-1', status: 'pending'
      }
    },
    {
      id: 'workflow-sent',
      user_id: 'user-1',
      post_id: 'post-2',
      outbox_event_id: 'event-2',
      collection_capture_outbox: {
        id: 'event-2', user_id: 'user-1', aggregate_id: 'post-2', status: 'sent'
      }
    },
    {
      id: 'workflow-mismatch',
      user_id: 'user-1',
      post_id: 'post-3',
      outbox_event_id: 'event-3',
      collection_capture_outbox: {
        id: 'event-3', user_id: 'user-1', aggregate_id: 'other-post', status: 'pending'
      }
    }
  ], { now: '2026-09-15T00:00:00.000Z' });

  assert.equal(manifest.mode, 'dry_run');
  assert.equal(manifest.writes_performed, false);
  assert.deepEqual(manifest.ack_candidates.map(item => item.workflow_id), ['workflow-match']);
  assert.deepEqual(manifest.rejected, [{
    workflow_id: 'workflow-mismatch',
    outbox_event_id: 'event-3',
    reason: 'post_mismatch'
  }]);
  assert.equal(manifest.summary.already_acknowledged, 1);
});
