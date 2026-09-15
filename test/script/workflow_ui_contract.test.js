import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = relativePath => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('post browsing surfaces workflow filtering and a human-readable next step on cards and details', () => {
    const viewAll = read('src/pages/ViewAllPage.jsx');
    const card = read('src/components/PostCard.jsx');
    const detail = read('src/components/PostDetailView.jsx');

    assert.match(viewAll, /WORKFLOW_FILTER_OPTIONS/);
    assert.match(viewAll, /matchesWorkflowFilter/);
    assert.match(viewAll, /aria-label="依流程狀態篩選貼文"/);
    assert.match(card, /workflowNextStep/);
    assert.match(card, /下一步：/);
    assert.match(detail, /workflowNextStep/);
    assert.match(detail, /下一步：/);
});
