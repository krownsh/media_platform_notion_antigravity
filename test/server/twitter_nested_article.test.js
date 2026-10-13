import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyNestedTwitterArticleCapture,
    buildEvidenceBundle,
    extractNestedLongformSources,
    recordNestedTwitterArticleFailure
} from '../../server/services/crawlerService/twitterCrawler.js';
import { captureQualityForData } from '../../server/services/captureProcessingService.js';

const ARTICLE_ID = '2108447079630802944';
const ARTICLE_URL = `https://x.com/i/article/${ARTICLE_ID}`;

test('X TweetResult Article payload becomes a captured canonical nested source', () => {
    const sources = extractNestedLongformSources({
        article: {
            rest_id: ARTICLE_ID,
            title: 'A complete X Article',
            rich_text: { plain_text: 'The article body is captured from the X TweetResult payload.' }
        }
    });

    assert.equal(sources.length, 1);
    assert.equal(sources[0].canonical_url, ARTICLE_URL);
    assert.equal(sources[0].capture_status, 'captured');
    assert.match(sources[0].content, /article body/);
    assert.match(sources[0].immutable_capture_revision, /^[a-f0-9]{64}$/);
    assert.equal(buildEvidenceBundle(sources).status, 'nested_longform_captured');
});

test('an X Article card without a body stays partial until its canonical page is captured', () => {
    const sources = extractNestedLongformSources({
        article: { rest_id: ARTICLE_ID, title: 'Article card only' }
    });
    const data = {
        content: 'Parent teaser',
        images: [],
        full_json: [{
            main_text: 'Parent teaser',
            nested_longform_sources: sources,
            evidence_bundle: buildEvidenceBundle(sources)
        }]
    };

    assert.equal(data.full_json[0].evidence_bundle.status, 'nested_longform_partial');
    assert.equal(captureQualityForData(data), 'partial');

    applyNestedTwitterArticleCapture(data, ARTICLE_URL, {
        original_url: ARTICLE_URL,
        title: 'Recovered Article',
        content: 'This is the canonical public Article body recovered by the second capture.',
        images: ['https://img.example/article-cover.jpg']
    });

    assert.equal(data.full_json[0].nested_longform_sources[0].capture_status, 'captured');
    assert.equal(data.full_json[0].evidence_bundle.status, 'nested_longform_captured');
    assert.equal(captureQualityForData(data), 'complete');
    assert.match(data.content, /Parent teaser/);
    assert.match(data.content, /canonical public Article body/);
    assert.deepEqual(data.images, ['https://img.example/article-cover.jpg']);
});

test('a failed canonical Article capture is explicit and keeps the evidence bundle partial', () => {
    const sources = extractNestedLongformSources({ article: { rest_id: ARTICLE_ID, title: 'Article card only' } });
    const data = {
        content: 'Parent teaser',
        full_json: [{
            main_text: 'Parent teaser',
            nested_longform_sources: sources,
            evidence_bundle: buildEvidenceBundle(sources)
        }]
    };

    recordNestedTwitterArticleFailure(data, ARTICLE_URL, new Error('login wall'));

    assert.equal(data.full_json[0].nested_longform_sources[0].capture_status, 'failed');
    assert.equal(data.full_json[0].evidence_bundle.status, 'nested_longform_failed');
    assert.equal(captureQualityForData(data), 'partial');
    assert.match(data.full_json[0].nested_longform_sources[0].capture_error, /login wall/);
});
