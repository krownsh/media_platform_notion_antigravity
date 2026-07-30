import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { suggestTopicMatches } from '../../server/services/topicAgent.js';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const sql = fs.readFileSync(path.join(projectRoot, 'database', 'deployments', 'stage_c_topic_workspaces.sql'), 'utf8');

test('Topic Agent returns explainable suggestions without auto-accepting a match', () => {
    const matches = suggestTopicMatches({
        content: 'This GitHub repository improves agent orchestration and local knowledge workflows.',
        source_domains: ['github.com']
    }, [{
        id: 'topic_agents',
        title: 'AI Agent 實戰',
        description: 'Agent orchestration and local knowledge workflows',
        keywords: ['GitHub', 'agent'],
        status: 'active'
    }]);

    assert.equal(matches.length, 1);
    assert.equal(matches[0].topic_id, 'topic_agents');
    assert.equal(matches[0].matched_by, 'rule');
    assert.equal(matches[0].status, 'suggested');
    assert.ok(matches[0].matched_terms.includes('agent'));
});

test('Topic workspace schema keeps agent proposals and source matches under user control', () => {
    assert.match(sql, /create table if not exists public\.collection_topics/);
    assert.match(sql, /origin text not null default 'user' check \(origin in \('user', 'agent_proposal'\)\)/);
    assert.match(sql, /check \(origin <> 'agent_proposal' or status = 'proposed'\)/);
    assert.match(sql, /create table if not exists public\.collection_topic_source_matches/);
    assert.match(sql, /status text not null default 'suggested'/);
    assert.match(sql, /alter table public\.collection_topics enable row level security/);
    assert.match(sql, /to authenticated[\s\S]+\(select auth\.uid\(\)\) = user_id/);
});
