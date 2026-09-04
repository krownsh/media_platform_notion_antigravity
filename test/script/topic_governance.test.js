import assert from 'node:assert/strict';
import test from 'node:test';

import { persistTopicDecision } from '../../server/services/autonomousKnowledgeService.js';
import { stageCodexPreprocessWorkflow } from '../../server/services/codexRemotePreprocessService.js';
import {
    normalizeProjectTarget,
    normalizeTopicDomain
} from '../../server/services/topicGovernanceService.js';

test('project and domain inputs use the controlled project-first vocabulary', () => {
    assert.equal(normalizeProjectTarget('github:Krownsh/My-sticker-book'), 'github:krownsh/my-sticker-book');
    assert.equal(normalizeProjectTarget('https://github.com/krownsh/repo'), null);
    assert.equal(normalizeTopicDomain('agent_workflow'), 'agent_workflow');
    assert.equal(normalizeTopicDomain('random-topic'), null);
});

test('Hermes keeps an unmatched model topic as a proposal and never inserts it', async () => {
    let insertCalled = false;
    const query = {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: null, error: null }),
        insert() { insertCalled = true; throw new Error('must not insert an automatic topic'); }
    };
    const result = await persistTopicDecision({
        collection_posts: { id: 'post-1234567890', user_id: 'user-1' }
    }, {
        title: 'Automatic topic candidate', slug: 'automatic-topic', confidence: 0.91, keywords: ['agent']
    }, { rationale: 'Model evidence' }, { from: () => query });

    assert.equal(insertCalled, false);
    assert.equal(result.deferred, true);
    assert.equal(result.reason, 'no_existing_topic');
    assert.equal(result.proposal.suggested_title, 'Automatic topic candidate');
});

test('remote Codex preprocessing stores a proposal in context but strips the unsafe topic write input', async () => {
    let params = null;
    const response = await stageCodexPreprocessWorkflow({
        workflowId: 'workflow-1',
        agentId: 'codex:test',
        result: {
            topic: { title: 'Candidate', slug: 'candidate', confidence: 0.95 },
            relation: { kind: 'related', confidence: 0.9 }
        }
    }, {
        rpc: async (_name, received) => {
            params = received;
            return { data: { workflow_id: 'workflow-1' }, error: null };
        }
    });

    assert.equal(response.workflow_id, 'workflow-1');
    assert.equal(params.p_result.topic, null);
    assert.equal(params.p_result.relation, null);
    assert.equal(params.p_result.topic_proposal.topic.suggested_title, 'Candidate');
});
