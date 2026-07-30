import puppeteer from 'puppeteer';

const TARGET_URL = 'https://www.threads.net/@w0955313233/post/DRE83NWEy6J';

async function debugLogic() {
    console.log(`[Debug] Starting logic debug for: ${TARGET_URL}`);
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('div[data-pressable-container="true"]', { timeout: 15000 });

        const results = await page.evaluate(() => {
            const allContainers = Array.from(document.querySelectorAll('div[data-pressable-container="true"]'));
            const commentContainers = allContainers.slice(1);

            return commentContainers.map((container, index) => {
                const html = container.innerHTML;
                const hasPath = html.includes('m2.5 4.2 4 4 4-4');
                const hasRotate = html.includes('rotate(270deg)');
                const hasReplyCurve = hasPath || hasRotate;

                // Extract user for identification
                const userLink = container.querySelector('a[href^="/@"]:not([href*="/post/"])');
                const user = userLink ? userLink.innerText : 'unknown';

                return {
                    index,
                    user,
                    hasPath,
                    hasRotate,
                    hasReplyCurve,
                    className: container.className,
                    htmlSnippet: html.substring(0, 500) // Longer snippet
                };
            });
        });

        results.forEach(r => {
            if (['c0fl0zllq8t9', 'pe21n6sb73dax', 'zo2y26dc346l'].includes(r.user)) {
                console.log(`User: ${r.user}, Class: ${r.className}, Length: ${r.className.length}`);
            }
        });

    } catch (error) {
        console.error(`[Debug] Error: ${error.message}`);
    } finally {
        await browser.close();
    }
}

debugLogic();
