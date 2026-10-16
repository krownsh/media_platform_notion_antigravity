import puppeteer from 'puppeteer';

const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const LOGIN_WALL = /(?:註冊 Instagram|登入以按讚或回應|登入 Instagram|Log in to Instagram|Sign up for Instagram|Continue with Instagram)/i;
const LOGIN_CONTROL = /^(?:登入|註冊|開啟應用程式|開啟 Instagram|Log in|Sign up|Open Instagram)$/i;
const CONTENT_BOUNDARY = /^(?:查看全部|View all|\d[\d,.]*\s*(?:個讚|likes?|comments?|則留言)|\d+\s*(?:分鐘|小時|天|minutes?|hours?|days?)前|登入|註冊|開啟 Instagram|Log in|Sign up)/i;

function text(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueMedia(items) {
    const seen = new Set();
    return items.filter(item => {
        const key = item?.url;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function normalizeInstagramUrl(value) {
    const url = new URL(value);
    url.protocol = 'https:';
    url.hostname = 'www.instagram.com';
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') + '/';
    return url.toString();
}

export function isInstagramLoginWall(bodyText) {
    return LOGIN_WALL.test(text(bodyText));
}

export function extractInstagramCaption(bodyText, author) {
    const lines = String(bodyText || '')
        .split(/\r?\n/)
        .map(text)
        .filter(Boolean);
    if (!author) return null;

    const authorIndexes = lines
        .map((line, index) => line === author ? index : -1)
        .filter(index => index >= 0);
    const start = authorIndexes.at(-1);
    if (start === undefined) return null;

    const parts = [];
    for (const line of lines.slice(start + 1)) {
        if (CONTENT_BOUNDARY.test(line) || LOGIN_CONTROL.test(line)) break;
        if (line === author || line === '•' || line === '追蹤' || line === 'Follow') continue;
        parts.push(line);
    }
    const caption = text(parts.join('\n'));
    return caption && !isInstagramLoginWall(caption) ? caption : null;
}

function authorFromMeta(metaDescription, mediaAlt) {
    const metaMatch = text(metaDescription).match(/-\s*(.+?)\s*(?:於|on)\s+/i);
    if (metaMatch?.[1]) return text(metaMatch[1]);
    const altMatch = text(mediaAlt).match(/(?:Photo|Video) by\s+(.+?)\s+on\s+/i);
    return altMatch?.[1] ? text(altMatch[1]) : null;
}

function isPostMedia(image) {
    const alt = text(image?.alt);
    const url = String(image?.url || '');
    if (!url || /(?:profile picture|大頭貼照)/i.test(alt)) return false;
    if (!/(?:cdninstagram|fbcdn\.net)/i.test(url)) return false;
    return /^(?:Photo|Video) by\s+/i.test(alt)
        || /(?:相片|照片|影片).*(?:來自|by)/i.test(alt)
        || (Number(image?.width) >= 320 && Number(image?.height) >= 320);
}

export function buildInstagramCapture({ originalUrl, canonicalUrl = originalUrl, bodyText, metaDescription, ogImage, images = [], postedAt = null }) {
    const postImages = uniqueMedia(images.filter(isPostMedia).map(image => ({
            url: image.url,
            alt_text: text(image.alt) || 'Instagram 媒體',
            width: Number(image.width) || null,
            height: Number(image.height) || null
        })));
    // OG only provides a preview of the first item. Using it alongside DOM
    // media would create a duplicate image with a different CDN URL.
    const usableImages = postImages.length
        ? postImages
        : uniqueMedia(ogImage ? [{ url: ogImage, alt_text: 'Instagram OG 預覽圖' }] : []);
    const author = authorFromMeta(metaDescription, usableImages[0]?.alt_text);
    const caption = extractInstagramCaption(bodyText, author);
    const hasPublicEvidence = Boolean(author && (caption || usableImages.length));
    const accessLimited = isInstagramLoginWall(bodyText);
    const captureQuality = hasPublicEvidence ? 'complete' : 'partial';
    const title = caption || (author ? `Instagram 貼文｜${author}` : 'Instagram 貼文（來源待修復）');

    return {
        platform: 'instagram',
        originalUrl,
        original_url: originalUrl,
        title,
        author: author || null,
        content: caption || null,
        postedAt: postedAt || null,
        posted_at: postedAt || null,
        images: usableImages,
        comments: [],
        full_json: {
            source_type: 'instagram_public_page',
            evidence_bundle: {
                status: captureQuality === 'complete' ? 'no_nested_longform_found' : 'source_access_limited',
                capture_quality: captureQuality,
                access_limited: accessLimited,
                missing_fields: [
                    ...(caption ? [] : ['public_caption']),
                    ...(usableImages.length ? [] : ['post_media']),
                    ...(accessLimited ? ['comments_without_login'] : [])
                ]
            },
            instagram_public_evidence: {
                canonical_url: canonicalUrl,
                meta_description: text(metaDescription) || null,
                login_wall_present: accessLimited,
                captured_media_count: usableImages.length,
                media_alt_text: usableImages.map(image => image.alt_text)
            }
        }
    };
}

async function browserOptions() {
    return {
        headless: 'new',
        executablePath: process.env.VITE_PUPPETEER_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=430,932']
    };
}

async function readPageEvidence(page) {
    return page.evaluate(() => ({
        bodyText: document.body?.innerText || '',
        metaDescription: document.querySelector('meta[name="description"]')?.content || document.querySelector('meta[property="og:description"]')?.content || '',
        ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
        postedAt: document.querySelector('time')?.getAttribute('datetime') || null,
        images: Array.from(document.images).map(image => ({
            url: image.currentSrc || image.src,
            alt: image.alt || '',
            width: image.naturalWidth || image.width || 0,
            height: image.naturalHeight || image.height || 0
        }))
    }));
}

async function collectCarouselMedia(page) {
    const all = [];
    for (let step = 0; step < 25; step += 1) {
        const evidence = await readPageEvidence(page);
        all.push(...evidence.images);
        const hasNext = await page.evaluate(() => Boolean(document.querySelector('button[aria-label="下一步"], button[aria-label="Next"]')));
        if (!hasNext) return { ...evidence, images: all };
        const before = new Set(all.map(image => image.url));
        await page.evaluate(() => document.querySelector('button[aria-label="下一步"], button[aria-label="Next"]')?.click());
        await new Promise(resolve => setTimeout(resolve, 900));
        const after = await readPageEvidence(page);
        all.push(...after.images);
        const changed = after.images.some(image => image.url && !before.has(image.url));
        if (!changed) return { ...after, images: all };
    }
    const finalEvidence = await readPageEvidence(page);
    return { ...finalEvidence, images: all };
}

export async function scrapeInstagramPost(url) {
    const requestedUrl = url;
    const canonicalUrl = normalizeInstagramUrl(url);
    const browser = await puppeteer.launch(await browserOptions());
    const page = await browser.newPage();
    try {
        await page.setUserAgent(MOBILE_USER_AGENT);
        await page.setViewport({ width: 430, height: 932, isMobile: true, hasTouch: true });
        await page.goto(canonicalUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        const evidence = await collectCarouselMedia(page);
        // The durable post identity remains the exact URL submitted by the
        // Owner. Canonicalization is provenance only: replacing it here would
        // create a duplicate beside a legacy request that retained its query.
        const capture = buildInstagramCapture({ originalUrl: requestedUrl, canonicalUrl, ...evidence });
        if (capture.full_json.evidence_bundle.capture_quality === 'partial') {
            const error = new Error('Instagram public page did not expose usable post text or media; login wall was not stored as post content');
            error.code = 'INSTAGRAM_SOURCE_ACCESS_LIMITED';
            throw error;
        }
        return capture;
    } finally {
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}
