
import fetch from 'node-fetch'; // assuming it's available or use native fetch
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('server', '.env') });

const apiKey = process.env.MINIMAX_API_KEY;
const groupId = process.env.MINIMAX_GROUP_ID;

async function test() {
    console.log('Testing Minimax Connection...');
    console.log('API Key Len:', apiKey?.length);
    console.log('Group ID:', groupId);

    const url = 'https://api.minimax.io/v1/text/chatcompletion_v2';
    const body = {
        model: 'minimax-m2.7',
        messages: [{ role: 'user', name: 'User', content: 'Say hello' }]
    };

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    if (groupId) headers['x-group-id'] = groupId;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        const data = await res.json();
        console.log('Response Status:', res.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Fetch Error:', e.message);
    }
}

test();
