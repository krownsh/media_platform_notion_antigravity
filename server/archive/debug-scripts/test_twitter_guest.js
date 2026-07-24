
async function testGuestToken(url) {
    const appBearerToken = process.env.TWITTER_PUBLIC_BEARER_TOKEN?.trim();
    if (!appBearerToken) {
        throw new Error('Set TWITTER_PUBLIC_BEARER_TOKEN before running this manual test.');
    }
    console.log(`Testing ${url}...`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${appBearerToken}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        if (response.ok) {
            const data = await response.json();
            console.log('Success:', data);
        } else {
            const text = await response.text();
            console.log('Error Body:', text);
        }
    } catch (e) {
        console.error('Exception:', e.message);
    }
    console.log('---');
}

async function run() {
    await testGuestToken('https://api.twitter.com/1.1/guest/activate.json');
    await testGuestToken('https://api.x.com/1.1/guest/activate.json');
}

run();
