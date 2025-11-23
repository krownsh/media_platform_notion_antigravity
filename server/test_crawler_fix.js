import { scrapeThreadsPost } from '../src/services/crawlerService/threadsCrawler.js';

const url = 'https://www.threads.net/@w0955313233/post/DRE83NWEy6J';

async function test() {
    try {
        console.log('Testing crawler on:', url);
        const data = await scrapeThreadsPost(url);
        console.log('Comments found:', data.comments.length);

        data.comments.forEach((c, i) => {
            if (i < 10 || c.replies.length > 0) {
                console.log(`[${i}] User: ${c.user}, IsRoot: ${c.debug?.isRoot}, HasCurve: ${c.debug?.hasCurve}, ClassMatch: ${c.debug?.classMatch}, Replies: ${c.replies.length}`);
                if (c.replies.length > 0) {
                    c.replies.forEach((r, j) => {
                        console.log(`    [${j}] Reply User: ${r.user}, IsRoot: ${r.debug?.isRoot}, HasCurve: ${r.debug?.hasCurve}, ClassMatch: ${r.debug?.classMatch}`);
                    });
                }
            }
        });

    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();
