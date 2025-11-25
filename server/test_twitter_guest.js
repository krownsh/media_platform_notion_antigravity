
async function testGuestToken(url) {
    console.log(`Testing ${url}...`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
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
