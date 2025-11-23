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
            headless: false,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
        });
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`[ThreadsCrawler] Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('[ThreadsCrawler] Waiting for content to load...');
        try {
            await page.waitForSelector('div[data-pressable-container="true"]', { timeout: 20000 });
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('[ThreadsCrawler] Content loaded successfully');
        } catch (e) {
            console.log('[ThreadsCrawler] Timeout waiting for initial selectors, continuing anyway...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Extract meta data
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

        // Deep DOM Scraping
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

                const isBefore = (el1, el2) => {
                    if (!el2) return true;
                    return el1.compareDocumentPosition(el2) & Node.DOCUMENT_POSITION_FOLLOWING;
                };

                const allSpans = Array.from(document.querySelectorAll('span'));
                const relatedThreadsHeader = allSpans.find(s =>
                    s.innerText.includes('相關串文') ||
                    s.innerText.includes('More from') ||
                    s.innerText.includes('Suggested for you')
                );

                let allContainers = Array.from(document.querySelectorAll('div[data-pressable-container="true"]'));

                if (relatedThreadsHeader) {
                    allContainers = allContainers.filter(c => isBefore(c, relatedThreadsHeader));
                }

                if (allContainers.length === 0) return data;

                const mainContainer = allContainers[0];
                const commentContainers = allContainers.slice(1);

                const extractContent = (container) => {
                    const contentCandidates = Array.from(container.querySelectorAll('span[dir="auto"], div[dir="auto"]'));

                    const validContent = contentCandidates.filter(el => {
                        const text = el.innerText.trim();
                        if (!text) return false;
                        if (el.closest('a[href^="/@"]')) return false;
                        if (el.closest('time')) return false;
                        if (el.closest('[role="button"]')) return false;
                        if (['翻譯', 'Translate', 'See translation', '作者', '·', 'View replies'].some(kw => text === kw || text.endsWith(kw))) return false;
                        const datePattern = /^(\d{4}-\d{2}-\d{2}|\d+[天dwymh])$/;
                        if (datePattern.test(text)) return false;
                        return true;
                    });

                    return validContent.map(el => el.innerText).join('\n\n').trim();
                };

                // Extract Main Post Data
                const avatarImg = mainContainer.querySelector('img[alt*="的大頭貼照"], img[alt*="profile picture"]');
                if (avatarImg) data.avatar = avatarImg.src;

                const authorLink = mainContainer.querySelector('a[href^="/@"]:not([href*="/post/"])');
                if (authorLink) {
                    const href = authorLink.getAttribute('href');
                    const parts = href.split('/@');
                    if (parts.length > 1) {
                        data.authorHandle = parts[1].replace(/\/$/, '');
                    }
                    data.author = authorLink.innerText || data.authorHandle;
                }

                const timeEl = mainContainer.querySelector('time');
                if (timeEl) data.postedAt = timeEl.getAttribute('datetime');

                data.content = extractContent(mainContainer);

                const pictureImages = Array.from(mainContainer.querySelectorAll('picture img'));
                data.images = pictureImages
                    .map(img => img.src)
                    .filter(src => src && !src.includes('profile_pic') && !src.includes('p50x50'));
                data.images = [...new Set(data.images)];

                // Comments Extraction - Flat Structure (No Nesting)
                commentContainers.forEach((container) => {
                    const commentAvatar = container.querySelector('img[alt*="的大頭貼照"], img[alt*="profile picture"]');
                    const commentAuthorLink = container.querySelector('a[href^="/@"]:not([href*="/post/"])');
                    const commentTime = container.querySelector('time');

                    if (!commentAvatar || !commentAuthorLink) return;

                    let commentAuthor = '';
                    let commentHandle = '';
                    if (commentAuthorLink) {
                        const href = commentAuthorLink.getAttribute('href');
                        const parts = href.split('/@');
                        if (parts.length > 1) {
                            commentHandle = parts[1].replace(/\/$/, '');
                        }
                        commentAuthor = commentAuthorLink.innerText || commentHandle;
                    }

                    const commentContent = extractContent(container);
                    const commentTimestamp = commentTime ? commentTime.getAttribute('datetime') : '';

                    const commentObj = {
                        user: commentAuthor,
                        handle: commentHandle,
                        text: commentContent,
                        postedAt: commentTimestamp,
                        avatar: commentAvatar ? commentAvatar.src : '',
                        replies: [] // Keep empty array for compatibility
                    };

                    // All comments are root level - no nesting
                    data.comments.push(commentObj);
                });

                return data;
            });
        } catch (domError) {
            console.error('[ThreadsCrawler] DOM Scraping failed (continuing with meta data):', domError.message);
        }

        // Construct Full JSON for AI
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
            ...detailedData.comments.flatMap((comment, idx) => {
                const items = [{
                    index: idx + 1,
                    text: comment.text,
                    author: comment.user,
                    authorHandle: comment.handle,
                    postedAt: comment.postedAt,
                    outerHTML: `Comment by ${comment.user}: ${comment.text}`
                }];

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

            full_json: fullJsonData,

            raw: { meta: metaData, dom: detailedData }
        };

        console.log('[ThreadsCrawler] Final Data:', finalData);
        console.log(`[ThreadsCrawler] Found ${finalData.comments.length} root comments`);

        return finalData;

    } catch (error) {
        console.error(`[ThreadsCrawler] ❌ Puppeteer failed: ${error.message}`);

        try {
            console.log('[ThreadsCrawler] 🔄 Attempting fallback to Apify...');
            const apifyResult = await scrapeWithApify(url);
            if (apifyResult) return apifyResult;

            throw error;
        } catch (apifyError) {
            console.error(`[ThreadsCrawler] ❌ Apify fallback failed: ${apifyError.message}`);
            throw new Error(`Failed to scrape Threads post. Puppeteer blocked/failed and Apify fallback is not configured.`);
        }
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
