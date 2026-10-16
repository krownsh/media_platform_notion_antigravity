import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildInstagramCapture,
    extractInstagramCaption,
    isInstagramLoginWall,
    normalizeInstagramUrl
} from '../../server/services/crawlerService/instagramCrawler.js';

test('Instagram URLs are canonicalized before public capture', () => {
    assert.equal(
        normalizeInstagramUrl('https://instagram.com/p/ABC123/?img_index=7&token=untrusted'),
        'https://www.instagram.com/p/ABC123/'
    );
});

test('canonical URL is provenance and never replaces the submitted post identity', () => {
    const capture = buildInstagramCapture({
        originalUrl: 'https://www.instagram.com/p/ABC123/?img_index=7',
        canonicalUrl: 'https://www.instagram.com/p/ABC123/',
        bodyText: '帳號A\n公開正文\n查看全部12則留言',
        metaDescription: '1,234 likes - 帳號A 於 October 16, 2026',
        images: [{ url: 'https://cdninstagram.com/a.jpg', alt: 'Photo by 帳號A on October 16, 2026.', width: 1080, height: 1350 }]
    });
    assert.equal(capture.original_url, 'https://www.instagram.com/p/ABC123/?img_index=7');
    assert.equal(capture.full_json.instagram_public_evidence.canonical_url, 'https://www.instagram.com/p/ABC123/');
});

test('a login wall is never treated as post content', () => {
    const body = '登入\n註冊 Instagram 帳號\n繼續操作即表示你同意 Instagram 的《使用條款》和《隱私政策》。';
    assert.equal(isInstagramLoginWall(body), true);
    const capture = buildInstagramCapture({
        originalUrl: 'https://www.instagram.com/p/blocked/',
        bodyText: body,
        metaDescription: '',
        ogImage: '',
        images: []
    });
    assert.equal(capture.full_json.evidence_bundle.capture_quality, 'partial');
    assert.equal(capture.content, null);
    assert.doesNotMatch(JSON.stringify(capture), /繼續操作即表示/);
});

test('public caption and carousel images are kept even when the page also offers login', () => {
    const body = [
        '登入', '帳號A', '•', '追蹤', '1,234個讚', '帳號A',
        '這是公開貼文的正文。', '第二行補充。', '查看全部12則留言', '登入以按讚或回應。'
    ].join('\n');
    assert.equal(extractInstagramCaption(body, '帳號A'), '這是公開貼文的正文。 第二行補充。');
    const capture = buildInstagramCapture({
        originalUrl: 'https://www.instagram.com/p/real/',
        bodyText: body,
        metaDescription: '1,234 likes - 帳號A 於 October 16, 2026',
        ogImage: 'https://cdninstagram.com/og.jpg',
        images: [
            { url: 'https://cdninstagram.com/a.jpg', alt: 'Photo by 帳號A on October 16, 2026.', width: 1080, height: 1350 },
            { url: 'https://cdninstagram.com/b.jpg', alt: 'Photo by 帳號A on October 16, 2026.', width: 1080, height: 1350 },
            { url: 'https://cdninstagram.com/avatar.jpg', alt: '帳號A的大頭貼照', width: 150, height: 150 }
        ]
    });
    assert.equal(capture.platform, 'instagram');
    assert.equal(capture.author, '帳號A');
    assert.equal(capture.content, '這是公開貼文的正文。 第二行補充。');
    assert.equal(capture.images.length, 2);
    assert.equal(capture.full_json.evidence_bundle.capture_quality, 'complete');
    assert.equal(capture.full_json.instagram_public_evidence.login_wall_present, true);
});
