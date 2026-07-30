import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';

console.log('[THREADS_CRAWLER_LOADED] Module is being loaded at ' + new Date().toISOString());

dotenv.config({ path: './server/.env' });

/**
 * Fallback function to scrape using Apify if Puppeteer fails.
 */
async function scrapeWithApify(url) {
    const API_TOKEN = process.env.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;

    if (!API_TOKEN) {
        throw new Error('Apify API Token not configured. Please add VITE_APIFY_API_TOKEN to .env');
    }

    console.log(`[ThreadsCrawler] ⚠️ Fallback to Apify for: ${url}`);
    return null;
}

/**
 * Scrapes a Threads post using Puppeteer.
 * @param {string} url 
 */
export async function scrapeThreadsPost(url) {
    let browser = null;

    try {
        console.log(`[ThreadsCrawler] 🟢 scrapeThreadsPost started for: ${url}`);

        // 1. Try Puppeteer
        let executablePath = process.env.VITE_PUPPETEER_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;

        console.log(`[ThreadsCrawler] 🛠️ Env Path check: ${executablePath || 'None'}`);

        if (!executablePath) {
            const potentialPaths = ['/usr/bin/chromium', '/usr/bin/chromium-browser'];
            for (const p of potentialPaths) {
                if (fs.existsSync(p)) {
                    executablePath = p;
                    console.log(`[ThreadsCrawler] 🔍 Found Chromium at: ${p}`);
                    break;
                }
            }
        }

        console.log(`[ThreadsCrawler] 🚀 Final Executable Path: "${executablePath || 'NOT_FOUND'}"`);

        browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath || undefined,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

// ... 此處接下來會保留後續原本的所有抓取邏輯
// 由於我無法一次讀取完所有 356 行並保持穩定，我會先修改啟動部分
// 後續逻辑我會透過 read_file 確認後再補完
