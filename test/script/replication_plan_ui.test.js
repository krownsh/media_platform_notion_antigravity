import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const card = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'PostCard.jsx'), 'utf8');
const detail = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'PostDetailView.jsx'), 'utf8');
const presentation = fs.readFileSync(path.join(projectRoot, 'src', 'utils', 'workflowPresentation.js'), 'utf8');
const decision = fs.readFileSync(path.join(projectRoot, 'scripts', 'agent-sdk', 'decide-workflow.js'), 'utf8');

test('replication plans keep their details and are visible on cards and post details', () => {
    assert.match(decision, /acceptance_criteria/);
    assert.match(decision, /type === 'replication_plan'/);
    assert.match(card, /actionBadges/);
    assert.match(presentation, /replication_plan/);
    assert.match(presentation, /復刻方案/);
    assert.match(detail, /復刻方案/);
    assert.match(detail, /正式 Project/);
});
