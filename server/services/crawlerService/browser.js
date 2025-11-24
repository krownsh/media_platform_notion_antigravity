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
            this.browser = await puppeteer.launch({
                headless: "new", // Use new headless mode
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
        const page = await this.browser.newPage();

        // Set User-Agent to mimic a desktop browser (or mobile if needed)
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        try {
            console.log(`[CrawlerService] Navigating to ${url}...`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Take a screenshot
            const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 80 });
            const screenshotBase64 = screenshotBuffer.toString('base64');

            // Get Raw HTML
            const html = await page.content();

            // Basic Extraction (Placeholder - needs platform specific parsers)
            const title = await page.title();

            // TODO: Implement specific parsers here based on platform
            // e.g., const data = await parseInstagram(page);

            return {
                success: true,
                platform,
                originalUrl: url,
                title,
                screenshot: `data:image/jpeg;base64,${screenshotBase64}`,
                html, // Store this for backup
                // ... extracted data
            };

        } catch (error) {
            console.error(`[CrawlerService] Error crawling ${url}:`, error);
            return { success: false, error: error.message };
        } finally {
            await page.close();
        }
    }
}

export const crawlerService = new CrawlerService();
