import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { claimCronWorkflow } from '../../scripts/agent-sdk/claim-cron-workflow.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function workflow() {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        outbox_event_id: '22222222-2222-4222-8222-222222222222',
        source_type: 'url_capture',
        stage: 'triage',
        status: 'processing',
        failed_stage: null,
        last_error: null,
        action_plan: { schema_version: 2, actions: [] },
        collection_posts: {
            id: '33333333-3333-4333-8333-333333333333',
            platform: 'generic',
            original_url: 'https://example.com/post',
            title: 'Cron source',
            author_name: 'Author',
            content: 'Captured content',
            full_json: {},
            collection_post_media: [],
            collection_post_analysis: {
                analysis_status: 'completed',
                analysis_source: 'capture_ai',
                summary: 'Summary',
                primary_category: 'tool',
                tags: ['cron'],
                topics: ['automation']
            }
        }
    };
}

test('Cron gate returns one atomically claimed workflow with a stable identity', async () => {
    const calls = [];
    const result = await claimCronWorkflow({ leaseSeconds: 900 }, {
        claim: async input => {
            calls.push(input);
            return workflow();
        }
    });

    assert.deepEqual(calls, [{ agentId: 'hermes:cron:media-inbox', leaseSeconds: 900, queue: 'preprocess' }]);
    assert.equal(result.ok, true);
    assert.equal(result.wakeAgent, true);
    assert.equal(result.workflow.workflow_id, workflow().id);
    assert.equal(result.workflow.status, 'processing');
    assert.equal(result.workflow.post.content, 'Captured content');
});

test('Cron gate stays silent when the singleton lease or queue has no work', async () => {
    const result = await claimCronWorkflow({}, { claim: async () => null });
    assert.deepEqual(result, {
        ok: true,
        wakeAgent: false,
        agentId: 'hermes:cron:media-inbox',
        leaseSeconds: 1800,
        queue: 'preprocess',
        workflow: null
    });
});

test('cleanup migration removes only the legacy dispatcher and keeps Cron lease objects', () => {
    const migration = fs.readFileSync(
        path.join(projectRoot, 'database', 'deployments', 'stage_j_hermes_cron_pull_cleanup.sql'),
        'utf8'
    );
    assert.match(migration, /drop trigger if exists enqueue_collection_hermes_dispatch/i);
    assert.match(migration, /drop table if exists public\.collection_hermes_dispatches/i);
    assert.match(migration, /drop table if exists public\.collection_hermes_agent_slots/i);
    assert.match(migration, /create table if not exists public\.collection_hermes_cron_leases/i);
    assert.doesNotMatch(migration, /cron_eligible_after/i);
    assert.doesNotMatch(migration, /created_at\s*>=\s*lease\./i);
    assert.match(migration, /claim_collection_hermes_cron_workflow/i);
    assert.match(migration, /heartbeat_collection_hermes_cron_workflow/i);
    assert.match(migration, /release_collection_hermes_cron_workflow/i);
    assert.doesNotMatch(migration, /drop\s+.*\bcascade\b/i);
});

test('backlog migration removes the date cutoff and keeps FIFO claim semantics', () => {
    const migration = fs.readFileSync(
        path.join(projectRoot, 'database', 'deployments', 'stage_j_hermes_cron_include_backlog.sql'),
        'utf8'
    );
    assert.match(migration, /drop column if exists cron_eligible_after/i);
    assert.match(migration, /where workflow\.status in \('pending', 'failed'\)/i);
    assert.match(migration, /order by[\s\S]*workflow\.created_at asc/i);
    assert.doesNotMatch(migration, /created_at\s*>=\s*lease\./i);
});

test('autonomous preprocess migration separates preprocess, research, and review queues', () => {
    const migration = fs.readFileSync(
        path.join(projectRoot, 'database', 'deployments', 'stage_k_hermes_autonomous_preprocess.sql'),
        'utf8'
    );
    assert.match(migration, /add column if not exists canonical_url/i);
    assert.match(migration, /add column if not exists content_hash/i);
    assert.match(migration, /stage in \('base_analysis', 'triage', 'preprocessing', 'strategy', 'research', 'review', 'actions', 'complete'\)/i);
    assert.match(migration, /p_queue text default 'preprocess'/i);
    assert.match(migration, /workflow\.stage = 'research'/i);
    assert.doesNotMatch(migration, /workflow\.stage = 'review'/i);
});

test('Vault sync migration adds a dedicated queue without changing the preprocess queue', () => {
    const migration = fs.readFileSync(
        path.join(projectRoot, 'database', 'deployments', 'stage_l_codex_vault_sync.sql'),
        'utf8'
    );
    assert.match(migration, /'vault_sync'/i);
    assert.match(migration, /p_queue.*'preprocess', 'research', 'vault_sync'/i);
    assert.match(migration, /workflow\.stage = 'vault_sync'/i);
    assert.match(migration, /stage in \([\s\S]*'vault_sync'/i);
});

test('Codex remote preprocess migration parks work before the local Vault write', () => {
    const migration = fs.readFileSync(
        path.join(projectRoot, 'database', 'deployments', 'stage_m_codex_remote_preprocess.sql'),
        'utf8'
    );
    assert.match(migration, /create or replace function public\.codex_stage_collection_preprocess/i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /set stage = 'vault_sync'/i);
    assert.match(migration, /grant execute[\s\S]*service_role/i);
    assert.doesNotMatch(migration, /pgvector|embedding\s+(?:column|table|extension)/i);
});

test('legacy JSON summaries are normalized without guessing malformed rows', () => {
    const migration = fs.readFileSync(
        path.join(projectRoot, 'database', 'deployments', 'stage_m_2_normalize_legacy_analysis_summaries.sql'),
        'utf8'
    );
    assert.match(migration, /core_insight/i);
    assert.match(migration, /key_points/i);
    assert.match(migration, /exception when others/i);
    assert.match(migration, /vault_sync.*note_input/s);
});

test('Hermes Cron gate delegates to an atomic claim command, not the old selector', () => {
    const gate = fs.readFileSync(path.join(projectRoot, 'scripts', 'hermes', 'media-inbox-gate.py'), 'utf8');
    assert.match(gate, /claim-cron-workflow\.js/);
    assert.doesNotMatch(gate, /next-workflow\.js/);
});
