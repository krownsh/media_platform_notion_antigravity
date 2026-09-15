import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = relativePath => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('posts API projects independent parallel tracks from workflow context', () => {
    const server = read('server/index.js');

    assert.match(server, /normalizeParallelTracks/);
    assert.match(server, /parallelTracks:\s*normalizeParallelTracks\(post\.collection_post_workflows\?\.\[0\]\?\.context\)/);
    assert.doesNotMatch(server, /parallelTracks:[\s\S]{0,180}outbox/);
});

test('post browsing surfaces workflow filtering and a human-readable next step on cards and details', () => {
    const viewAll = read('src/pages/ViewAllPage.jsx');
    const card = read('src/components/PostCard.jsx');
    const detail = read('src/components/PostDetailView.jsx');

    assert.match(viewAll, /WORKFLOW_FILTER_OPTIONS/);
    assert.match(viewAll, /matchesWorkflowFilter/);
    assert.match(viewAll, /aria-label="依流程狀態篩選貼文"/);
    assert.match(card, /workflowNextStep/);
    assert.match(card, /parallelTrackPresentation\(post\.parallelTracks\)/);
    assert.match(card, /parallelTracks\.map/);
    assert.match(card, /下一步：/);
    assert.match(detail, /workflowNextStep/);
    assert.match(detail, /parallelTrackPresentation\(post\.parallelTracks\)/);
    assert.match(detail, /知識收藏/);
    assert.match(detail, /專案應用/);
    assert.match(detail, /workflowGuidance/);
    assert.match(detail, /目前階段：/);
    assert.match(detail, /等待：/);
    assert.match(detail, /原因：/);
    assert.match(detail, /可做什麼：/);
});
