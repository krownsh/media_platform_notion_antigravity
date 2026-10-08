import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('a finalized capture gives the owner a source-led handoff without placing semantic decisions in the browser', () => {
    const home = read('src/pages/HomePage.jsx');
    const queue = read('src/components/CaptureReviewQueue.jsx');
    const reviewApi = read('src/api/reviewApi.js');
    const reviewSlice = read('src/features/reviewSlice.js');

    assert.match(home, /CaptureReviewQueue/);
    assert.match(queue, /你和 Agent 的對話中完成/);
    assert.match(queue, /查看這篇/);
    assert.match(queue, /貼文媒體預覽/);
    assert.doesNotMatch(queue, /按下按鈕才會建立可編輯的候選/);
    assert.match(queue, /來源已保存/);
    assert.match(queue, /source_revision_id/);
    assert.match(queue, /openFocus\(packet\.id\)/);
    assert.match(queue, /scrollIntoView/);
    assert.doesNotMatch(queue, /prepareReviewCandidates/);

    assert.match(reviewApi, /source-revisions\/\$\{sourceRevisionId\}\/prepare/);
    assert.match(reviewApi, /allow_partial/);
    assert.match(reviewSlice, /prepareReviewCandidates/);
    assert.match(reviewSlice, /selectReviewPacket/);
    assert.match(read('src\/components\/ReviewFocusPanel.jsx'), /activePacketId/);
    assert.match(read('src\/components\/ReviewFocusPanel.jsx'), /id="review-focus-mode"/);
    assert.doesNotMatch(read('src\/components\/ReviewFocusPanel.jsx'), /decideReviewProposal/);
    assert.match(read('server\/routes\/reviewRoutes.js'), /allow_partial/);
    assert.match(read('server\/services\/reviewProposalService.js'), /allowPartial/);
    assert.match(read('server\/services\/captureFinalizationService.js'), /reviewPreparer/);
});
