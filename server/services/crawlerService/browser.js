import puppeteer from 'puppeteer';

/**
 * Crawler Service
 * Manages a Headless Browser (Puppeteer) to scrape data when APIs fail.
 */
class CrawlerService {
    constructor() {
        this.browser = null;
    }

    async initBrowser() {
        if (!this.browser) {
            console.log('[CrawlerService] Launching browser...');
            const executablePath = process.env.VITE_PUPPETEER_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || null;

            this.browser = await puppeteer.launch({
                headless: "new", // Use new headless mode
                executablePath: executablePath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                ],
            });
        }
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Crawl a post URL.
     * @param {string} url 
     * @param {string} platform 
     */
    async crawlPost(url, platform) {
        await this.initBrowser();

        // 1. Create an isolated BrowserContext (Incognito)
        const context = await this.browser.createBrowserContext();
        const page = await context.newPage();

        try {
            // 2. Resource Optimization: Block redundant assets
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const type = req.resourceType();
                if (['image', 'font', 'media'].includes(type)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // Set User-Agent to mimic a desktop browser
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 800 });

            console.log(`[CrawlerService] [Context Isolated] Navigating to ${url}...`);

            // Navigate with custom headers
            await page.goto(url, {
                waitUntil: 'networkidle2', // Dynamic pages like Notion need more time
                timeout: 45000
            });

            // Notion/Dynamic Content Wait: Wait for a common content selector or wait a bit
            try {
                await page.waitForSelector('.notion-page-content, article, main, .content', { timeout: 10000 });
            } catch (e) {
                console.log('[CrawlerService] Timeout waiting for specific selectors, proceeding with body.');
            }

            // Basic Extraction
            const extractedData = await page.evaluate(() => {
                // Try to find the main content, fallback to body text
                // Specific Notion check: .notion-page-content
                const main = document.querySelector('.notion-page-content, .notion-body, article, main, .content, #content') || document.body;

                // Helper to clean text: remove multiple spaces, tabs, and keep only meaningful text
                const cleanText = (text) => {
                    return text
                        .replace(/\s+/g, ' ')
                        .replace(/\n\s*\n/g, '\n')
                        .trim();
                };

                const getMeta = (metaName) => {
                    return document.querySelector(`meta[name="${metaName}"]`)?.content ||
                        document.querySelector(`meta[property="og:${metaName}"]`)?.content ||
                        document.querySelector(`meta[property="${metaName}"]`)?.content || null;
                };

                return {
                    title: getMeta('title') || document.title,
                    mainText: cleanText(main.innerText),
                    ogImage: getMeta('image'),
                    author: getMeta('author')
                };
            });

            // Length Control & Meaningful Content Check
            const maxChars = 5000;
            let finalContent = extractedData.mainText;

            // If the content is too short (less than 20 chars), it might be a failed load or just a redirect page
            const isMeaningless = !finalContent || finalContent.length < 20;

            if (isMeaningless) {
                console.log(`[CrawlerService] Content too short (${finalContent?.length || 0} chars), using fallback.`);
                finalContent = `[無法解析內文，僅擷取連結] ${url}`;
            } else if (finalContent.length > maxChars) {
                finalContent = finalContent.substring(0, maxChars) + '... [已截斷]';
            }

            console.log(`[CrawlerService] Processing completed. Content length: ${finalContent.length}`);

            return {
                success: true,
                platform: platform || 'generic',
                originalUrl: url,
                original_url: url,
                title: extractedData.title || '未知標題',
                content: finalContent,
                images: extractedData.ogImage ? [extractedData.ogImage] : [],
                author: extractedData.author,
                crawledAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(`[CrawlerService] ❌ Error crawling ${url}:`, error);
            return { success: false, error: error.message };
        } finally {
            // 3. Close BOTH page and context to free memory
            await page.close();
            await context.close();
        }
    }
}

export const crawlerService = new CrawlerService();
