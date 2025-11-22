import puppeteer from 'puppeteer';

/**
 * Fallback function to scrape using Apify if Puppeteer fails.
 * This is currently a placeholder that will be implemented when the user provides an API Token.
 */
async function scrapeWithApify(url) {
    const API_TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;

    if (!API_TOKEN) {
        throw new Error('Apify API Token not configured. Please add VITE_APIFY_API_TOKEN to .env');
    }

    console.log(`[ThreadsCrawler] ⚠️ Fallback to Apify for: ${url}`);

    // TODO: Implement actual Apify Actor call here
    // Example:
    // const client = new ApifyClient({ token: API_TOKEN });
    // const run = await client.actor('curious_coder/threads-scraper').call({ postUrl: url });
    // ... fetch results ...

    return null;
}

/**
 * Scrapes a Threads post using Puppeteer.
 * Falls back to Apify if Puppeteer fails.
 * @param {string} url 
 * @returns {Promise<Object>} Scraped post data
 */
export async function scrapeThreadsPost(url) {
    console.log(`[ThreadsCrawler] 🕷️ Starting scrape for: ${url}`);
    let browser = null;

    try {
        // 1. Try Puppeteer
        browser = await puppeteer.launch({
            headless: false, // User requested to see the browser
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
        });
        const page = await browser.newPage();

        // Set User Agent to mimic a real browser to avoid immediate blocking
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to URL
        console.log(`[ThreadsCrawler] Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for content to load with longer timeout
        console.log('[ThreadsCrawler] Waiting for content to load...');
        try {
            await page.waitForSelector('div[data-pressable-container="true"]', { timeout: 20000 });
            // Additional wait for dynamic content (React hydration)
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('[ThreadsCrawler] Content loaded successfully');
        } catch (e) {
            console.log('[ThreadsCrawler] Timeout waiting for initial selectors, continuing anyway...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Still wait a bit
        }

        // Strategy A: Extract meta data first (fast and reliable)
        const metaData = await page.evaluate(() => {
            const getMetaContent = (name) => document.querySelector(`meta[name="${name}"]`)?.content || document.querySelector(`meta[property="og:${name}"]`)?.content;
            return {
                title: document.title,
                description: getMetaContent('description'),
                image: getMetaContent('image'),
                url: getMetaContent('url') || window.location.href,
            };
        });

        console.log('[ThreadsCrawler] Meta Data:', metaData);

        // Strategy B: Deep DOM Scraping
        let detailedData = {
            author: '',
            authorHandle: '',
            avatar: '',
            postedAt: '',
            content: '',
            images: [],
            videos: [],
            comments: []
        };

        try {
            detailedData = await page.evaluate(() => {
                const data = {
                    author: '',
                    authorHandle: '',
                    avatar: '',
                    postedAt: '',
                    content: '',
                    images: [],
                    videos: [],
                    comments: []
                };

                // Helper to check if an element is before another
                const isBefore = (el1, el2) => {
                    if (!el2) return true; // If no boundary, everything is valid
                    return el1.compareDocumentPosition(el2) & Node.DOCUMENT_POSITION_FOLLOWING;
                };

                // Find "Related Threads" boundary to stop scraping unrelated content
                const allSpans = Array.from(document.querySelectorAll('span'));
                const relatedThreadsHeader = allSpans.find(s =>
                    s.innerText.includes('相關串文') ||
                    s.innerText.includes('More from') ||
                    s.innerText.includes('Suggested for you')
                );

                // Get all post/comment containers
                // data-pressable-container="true" is a stable attribute in React Native Web
                let allContainers = Array.from(document.querySelectorAll('div[data-pressable-container="true"]'));

                // Filter out containers that are after the "Related Threads" section
                if (relatedThreadsHeader) {
                    allContainers = allContainers.filter(c => isBefore(c, relatedThreadsHeader));
                }

                if (allContainers.length === 0) return data;

                // --- 1. Main Post Extraction ---
                // The Main Post is consistently the first container in the feed on a post page.
                const mainContainer = allContainers[0];

                // Remove Main Post from the list to process the rest as comments
                const commentContainers = allContainers.slice(1);

                // --- Helper: Content Extraction ---
                const extractContent = (container) => {
                    const contentCandidates = Array.from(container.querySelectorAll('span[dir="auto"], div[dir="auto"]'));

                    const validContent = contentCandidates.filter(el => {
                        const text = el.innerText.trim();
                        if (!text) return false;

                        // Exclude author links (often appear as text)
                        if (el.closest('a[href^="/@"]')) return false;

                        // Exclude time elements
                        if (el.closest('time')) return false;

                        // Exclude buttons (Like, Reply, etc.)
                        if (el.closest('[role="button"]')) return false;

                        // Exclude specific UI keywords
                        if (['翻譯', 'Translate', 'See translation', '作者', '·', 'View replies'].some(kw => text === kw || text.endsWith(kw))) return false;

                        // Exclude pure dates/times if they somehow slipped through
                        const datePattern = /^(\d{4}-\d{2}-\d{2}|\d+[天dwymh])$/;
                        if (datePattern.test(text)) return false;

                        return true;
                    });

                    // Join paragraphs and clean up
                    return validContent.map(el => el.innerText).join('\n\n')
                    if (parts.length > 1) {
                        commentHandle = parts[1].replace(/\/$/, '');
                    }
                    commentAuthor = commentAuthorLink.innerText || commentHandle;
                }

                const commentContent = extractContent(container);

                const commentObj = {
                    user: commentAuthor,
                    handle: commentHandle,
                    text: commentContent,
                    postedAt: commentTime ? commentTime.getAttribute('datetime') : '',
                    avatar: commentAvatar ? commentAvatar.src : '',
                    replies: []
                };

                // --- Dynamic Nesting Logic ---
                // We assume the FIRST comment after the main post is ALWAYS a Root Comment.
                // We capture its class structure to identify other Root Comments.
                if (index === 0) {
                    rootClassSignature = container.className;
                }

                // If the current container has the same class structure as the first comment, it's a Root Comment.
                // Otherwise, it's likely a Reply (nested comment).
                // This avoids hardcoding unstable class names like 'xt8cgyo'.
                const isRootComment = rootClassSignature && container.className === rootClassSignature;

                if (isRootComment) {
                    // New Root Comment
                    data.comments.push(commentObj);
                    lastRootComment = commentObj;
                } else {
                    // Reply to the last Root Comment
                    if (lastRootComment) {
                        lastRootComment.replies.push(commentObj);
                    } else {
                        // Fallback: If no root exists yet (shouldn't happen if logic holds), treat as root
                        data.comments.push(commentObj);
                        lastRootComment = commentObj;
                    }
                }
            });

            return data;
        });
    } catch (domError) {
        console.error('[ThreadsCrawler] DOM Scraping failed (continuing with meta data):', domError.message);
    }

    // Construct Full JSON for AI (Array format matching debug structure)
    const fullJsonData = [
        {
            index: 0,
            text: detailedData.content || metaData.description || '',
            author: detailedData.author || 'Unknown',
            authorHandle: detailedData.authorHandle || 'unknown',
            postedAt: detailedData.postedAt || '',
            images: [...new Set([...(metaData.image ? [metaData.image] : []), ...detailedData.images])],
            outerHTML: `Main post content: ${detailedData.content || metaData.description || ''}`
        },
        // Add comments
        ...detailedData.comments.flatMap((comment, idx) => {
            const items = [{
                index: idx + 1,
                text: comment.text,
                author: comment.user,
                authorHandle: comment.handle,
                postedAt: comment.postedAt,
                outerHTML: `Comment by ${comment.user}: ${comment.text}`
            }];

            // Add replies
            if (comment.replies && comment.replies.length > 0) {
                comment.replies.forEach((reply, replyIdx) => {
                    items.push({
                        index: idx + 1 + replyIdx + 0.1,
                        text: reply.text,
                        author: reply.user,
                        authorHandle: reply.handle,
                        postedAt: reply.postedAt,
                        outerHTML: `Reply by ${reply.user}: ${reply.text}`
                    });
                });
            }

            return items;
        })
    ];

    // Merge Meta Data with Detailed Data
    const finalData = {
        platform: 'threads',
        originalUrl: url,
        scrapedAt: new Date().toISOString(),

        author: detailedData.author || 'Unknown',
        authorHandle: detailedData.authorHandle || 'unknown',
        avatar: detailedData.avatar || '',
        postedAt: detailedData.postedAt || '',

        content: detailedData.content || metaData.description || '',

        images: [...new Set([...(metaData.image ? [metaData.image] : []), ...detailedData.images])],
        videos: detailedData.videos,
        comments: detailedData.comments,

        // NEW: Full JSON for AI processing
        full_json: fullJsonData,

        raw: { meta: metaData, dom: detailedData }
    };

    console.log('[ThreadsCrawler] Final Data:', finalData);
    console.log(`[ThreadsCrawler] Found ${finalData.comments.length} root comments`);

    return finalData;

} catch (error) {
    console.error(`[ThreadsCrawler] ❌ Puppeteer failed: ${error.message}`);

    // 2. Fallback to Apify
    try {
        console.log('[ThreadsCrawler] 🔄 Attempting fallback to Apify...');
        const apifyResult = await scrapeWithApify(url);
        if (apifyResult) return apifyResult;

        // If Apify returns null (not implemented yet), re-throw original error
        throw error;
    } catch (apifyError) {
        console.error(`[ThreadsCrawler] ❌ Apify fallback failed: ${apifyError.message}`);
        // Throw a clean error for the frontend
        throw new Error(`Failed to scrape Threads post. Puppeteer blocked/failed and Apify fallback is not configured.`);
    }
} finally {
    if (browser) {
        await browser.close();
    }
}
}
