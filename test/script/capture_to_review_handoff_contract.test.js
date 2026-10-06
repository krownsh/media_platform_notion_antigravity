import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('a finalized capture has an explicit owner-controlled handoff into candidate review', () => {
    const home = read('src/pages/HomePage.jsx');
    const queue = read('src/components/CaptureReviewQueue.jsx');
    const reviewApi = read('src/api/reviewApi.js');
    const reviewSlice = read('src/features/reviewSlice.js');
    const saga = read('src/store/rootSaga.js');

    assert.match(home, /CaptureReviewQueue/);
    assert.match(queue, /建立候選整理/);
    assert.match(queue, /尚未進入正式知識/);
    assert.match(queue, /確認來源品質/);
    assert.match(queue, /source_revision_id/);
    assert.match(queue, /onClick=\{\(\) => dispatch\(prepareReviewCandidates/);
    assert.match(queue, /openFocus\(packet\.id\)/);
    assert.match(queue, /scrollIntoView/);

    assert.match(reviewApi, /source-revisions\/\$\{sourceRevisionId\}\/prepare/);
    assert.match(reviewApi, /allow_partial/);
    assert.match(reviewSlice, /prepareReviewCandidates/);
    assert.match(reviewSlice, /selectReviewPacket/);
    assert.match(saga, /handlePrepareReviewCandidates/);
    assert.match(saga, /prepareReviewCandidatesApi/);
    assert.match(read('src\/components\/ReviewFocusPanel.jsx'), /activePacketId/);
    assert.match(read('src\/components\/ReviewFocusPanel.jsx'), /id="review-focus-mode"/);
    assert.match(read('src\/components\/ReviewFocusPanel.jsx'), /以目前來源建立候選/);
    assert.match(read('server\/routes\/reviewRoutes.js'), /allow_partial/);
    assert.match(read('server\/services\/reviewProposalService.js'), /allowPartial/);
});
