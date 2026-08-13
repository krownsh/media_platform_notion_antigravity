import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    classifyWebhookWorkflow,
    processWebhookWorkflow
} from '../../scripts/agent-sdk/process-webhook-workflow.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW_ID = '22222222-2222-4222-8222-222222222222';
const DISPATCH_ID = '11111111-1111-4111-8111-111111111111';

test('webhook runner triages the exact pending URL workflow with a stable identity', async () => {
    let triageCall;
    const result = await processWebhookWorkflow({
        workflowId: WORKFLOW_ID,
        dispatchId: DISPATCH_ID
    }, {
        load: async id => ({ id, stage: 'triage', status: 'pending' }),
        startAgent: async input => input,
        triage: async (id, options) => {
            triageCall = { id, options };
            return { workflow_id: id, stage: 'strategy', status: 'awaiting_user' };
        }
    });

    assert.deepEqual(triageCall, {
        id: WORKFLOW_ID,
        options: {
            agentIdentity: `hermes:webhook:${DISPATCH_ID}`,
            dispatchId: DISPATCH_ID
        }
    });
    assert.equal(result.action, 'triaged');
    assert.equal(result.stage, 'strategy');
    assert.equal(result.status, 'awaiting_user');
});

test('webhook runner is idempotent after triage and does not call triage again', async () => {
    const result = await processWebhookWorkflow({
        workflowId: WORKFLOW_ID,
        dispatchId: DISPATCH_ID
    }, {
        load: async id => ({ id, stage: 'strategy', status: 'awaiting_user' }),
        startAgent: async () => assert.fail('agent must not start twice'),
        triage: async () => assert.fail('triage must not run twice')
    });
    assert.equal(result.action, 'awaiting_user');
});

test('webhook runner delegates image base analysis to Hermes instead of faking it', () => {
    assert.deepEqual(
        classifyWebhookWorkflow({ id: WORKFLOW_ID, stage: 'base_analysis', status: 'pending' }),
        { action: 'agent_required', reason: 'base_analysis' }
    );
});

test('webhook route requires execution before status reporting', () => {
    const route = fs.readFileSync(
        path.join(projectRoot, 'hermes', 'config', 'webhook-route.example.yaml'),
        'utf8'
    );
    assert.match(route, /first tool call MUST run/i);
    assert.match(route, /npm run agent:webhook -- \{workflow_id\} --dispatch \{dispatch_id\}/);
    assert.match(route, /Never call\s+agent:next from a webhook/i);
});
