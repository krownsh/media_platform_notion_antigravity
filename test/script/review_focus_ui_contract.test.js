import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const panel = fs.readFileSync(path.join(root, 'src/components/ReviewFocusPanel.jsx'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/pages/HomePage.jsx'), 'utf8');

test('source workspace shows an identifiable post and leaves semantic work to the Agent conversation', () => {
    for (const requirement of ['目前選擇的來源', 'SourcePreview', '查看完整貼文', '等待與 Agent 討論', '到收藏庫分類']) {
        assert.match(panel, new RegExp(requirement));
    }
    assert.doesNotMatch(panel, /decideReviewProposal/);
    assert.doesNotMatch(panel, /prepareReviewCandidates/);
    assert.doesNotMatch(panel, /接受候選/);
    assert.match(home, /ReviewFocusPanel/);
    assert.doesNotMatch(panel, /Knowledge Space/);
});
