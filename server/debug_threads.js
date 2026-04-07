import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// The URL provided by the user in the logs
const TARGET_URL = 'https://www.threads.net/@w0955313233/post/DRE83NWEy6J';

async function debugThreadsStructure() {
    console.log(`[Debug] Starting debug scrape for: ${TARGET_URL}`);
    const executablePath = process.env.VITE_PUPPETEER_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || null;

    const browser = await puppeteer.launch({
        headless: true, // 伺服器環境必須為 true
        executablePath: executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for comments to load
        try {
            await page.waitForSelector('div[data-pressable-container="true"]', { timeout: 15000 });
        } catch (e) {
            console.log('Timeout waiting for selector, proceeding anyway...');
        }

        // Extract the HTML structure of the feed
        // We want to see the hierarchy of 'data-pressable-container' elements
        const structure = await page.evaluate(() => {
            // Find the main feed container (usually the parent of the first post)
            const firstPost = document.querySelector('div[data-pressable-container="true"]');
            if (!firstPost) return 'No posts found';

            // Go up a few levels to find the common wrapper of all posts
            let wrapper = firstPost.parentElement;
            // We want to capture enough context. Let's try to capture the container that holds multiple pressable containers.
            // Usually 3-4 levels up.

            // Let's just grab the HTML of the first 10 pressable containers and their immediate parents
            const allContainers = Array.from(document.querySelectorAll('div[data-pressable-container="true"]')).slice(0, 10);

            return allContainers.map((c, index) => {
                // Get some attributes to identify it
                const text = c.innerText.substring(0, 50).replace(/\n/g, ' ');

                // Get hierarchy info
                let hierarchy = [];
                let curr = c;
                for (let i = 0; i < 5; i++) {
                    if (!curr) break;
                    hierarchy.push({
                        tagName: curr.tagName,
                        className: curr.className,
                        id: curr.id,
                        role: curr.getAttribute('role')
                    });
                    curr = curr.parentElement;
                }

                return {
                    index,
                    text,
                    hierarchy,
                    outerHTML: c.outerHTML // We might need this if hierarchy isn't enough
                };
            });
        });

        const outputPath = path.resolve('threads_debug_structure.json');
        fs.writeFileSync(outputPath, JSON.stringify(structure, null, 2));
        console.log(`[Debug] Structure saved to ${outputPath}`);

    } catch (error) {
        console.error(`[Debug] Error: ${error.message}`);
    } finally {
        await browser.close();
    }
}

debugThreadsStructure();
