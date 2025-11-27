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
    // console.log(`[ThreadsCrawler] 🕷️ Starting scrape for: ${url}`);
    let browser = null;

    try {
        // 1. Try Puppeteer
        browser = await puppeteer.launch({
            headless: true,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // console.log(`[ThreadsCrawler] Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // console.log('[ThreadsCrawler] Waiting for content to load...');
        try {
            await page.waitForSelector('div[data-pressable-container="true"]', { timeout: 20000 });
            // console.log('[ThreadsCrawler] Content loaded successfully');
        } catch (_e) {
            // console.log('[ThreadsCrawler] Timeout waiting for initial selectors, continuing anyway...');
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
                    // Clone the container to avoid modifying the live DOM
                    const clone = container.cloneNode(true);

                    // Remove UI elements that are not content
                    const elementsToRemove = [
                        'a[href^="/@"]',      // Author links
                        'time',               // Timestamps  
                        '[role="button"]',    // Buttons (Reply, Translate, etc.)
                        'svg',                // Icons
                        '[aria-label="讚"]',
                        '[aria-label="留言"]',
                        '[aria-label="轉發"]',
                        '[aria-label="分享"]',
                        '[aria-label="更多"]'
                    ];

                    elementsToRemove.forEach(selector => {
                        clone.querySelectorAll(selector).forEach(el => el.remove());
                    });

                    // Get all text content
                    let text = clone.innerText.trim();

                    // Remove common UI text patterns
                    const uiPatterns = [
                        /翻譯\s*$/,
                        /Translate\s*$/,
                        /See translation\s*$/,
                        /View replies\s*$/,
                        /作者\s*$/,
                        /已釘選\s*$/,
                        /Pinned\s*$/,
                        /^\d+[KMB萬億]?\s*$/  // Pure numbers like "400", "2.7萬"
                    ];

                    uiPatterns.forEach(pattern => {
                        text = text.replace(pattern, '').trim();
                    });

                    return text;
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

                    // Extract images from comment
                    const commentImages = Array.from(container.querySelectorAll('img'))
                        .filter(img => {
                            const src = img.src;
                            const alt = img.getAttribute('alt') || '';
                            const width = parseInt(img.getAttribute('width') || '0', 10);

                            // Exclude profile pictures
                            if (!src) return false;
                            if (src.includes('profile_pic') || src.includes('p50x50')) return false;
                            if (alt.includes('大頭貼照') || alt.includes('profile picture')) return false;

                            // Include if it's in a picture tag (standard for Threads media)
                            if (img.closest('picture')) return true;

                            // Include if it's inside the specific content wrapper class provided by user
                            if (img.closest('.xkbb5z.x13vxnyz')) return true;

                            // Include if it's large (likely media)
                            if (width > 150) return true;

                            return false;
                        })
                        .map(img => img.src);

                    const commentObj = {
                        user: commentAuthor,
                        handle: commentHandle,
                        text: commentContent,
                        postedAt: commentTimestamp,
                        avatar: commentAvatar ? commentAvatar.src : '',
                        images: [...new Set(commentImages)],
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

        // Filter out profile pics from meta image
        const isProfilePic = (url) => {
            if (!url) return false;
            if (url.includes('profile_pic')) return true;
            if (url.includes('s150x150') || url.includes('p50x50') || url.includes('s320x320')) return true;
            return false;
        };

        let combinedImages = detailedData.images;

        // If no images found in DOM, check if we should fallback to meta image
        if (combinedImages.length === 0) {
            // If DOM scraping was successful (we found author or content), we trust that there are truly no images.
            // We ignore metaData.image because it's likely the avatar (og:image).
            const domScrapeSuccess = detailedData.author || detailedData.content;

            if (!domScrapeSuccess && metaData.image && !isProfilePic(metaData.image)) {
                combinedImages = [metaData.image];
            }
        }

        combinedImages = [...new Set(combinedImages)];

        // Construct Full JSON for AI (New nested structure)
        const fullJsonData = [
            {
                main_text: detailedData.content || metaData.description || '',
                author: detailedData.author || 'Unknown',
                postedAt: detailedData.postedAt || '',
                images: combinedImages,
                replies: detailedData.comments.map(comment => ({
                    text: comment.text,
                    author: comment.user,
                    postedAt: comment.postedAt,
                    images: comment.images || []
                }))
            }
        ];

        const finalData = {
            platform: 'threads',
            originalUrl: url,
            original_url: url, // snake_case for database upsert
            scrapedAt: new Date().toISOString(),

            author: detailedData.author || 'Unknown',
            authorHandle: detailedData.authorHandle || 'unknown',
            avatar: detailedData.avatar || '',
            postedAt: detailedData.postedAt || '',
            posted_at: detailedData.postedAt || '',

            content: detailedData.content || metaData.description || '',

            images: combinedImages,
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
