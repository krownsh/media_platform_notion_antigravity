import { scrapeThreadsPost } from '../src/services/crawlerService/threadsCrawler.js';
import fs from 'fs';

const url = 'https://www.threads.com/@w0955313233/post/DRE83NWEy6J';

console.log('Testing comment structure extraction...\n');

try {
    const result = await scrapeThreadsPost(url);

    // Save full result to file
    fs.writeFileSync(
        './comment_structure_test.json',
        JSON.stringify(result, null, 2),
        'utf-8'
    );

    console.log('\n✅ Full result saved to comment_structure_test.json');

    // Print comment structure
    console.log('\n📊 Comment Structure:');
    console.log(`Total root comments: ${result.comments.length}\n`);

    result.comments.forEach((comment, idx) => {
        console.log(`${idx + 1}. [ROOT] ${comment.user}: "${comment.text.substring(0, 50)}..."`);
        console.log(`   Posted: ${comment.postedAt}`);
        console.log(`   Replies: ${comment.replies.length}`);

        if (comment.replies.length > 0) {
            comment.replies.forEach((reply, replyIdx) => {
                console.log(`   ${idx + 1}.${replyIdx + 1} [REPLY] ${reply.user}: "${reply.text.substring(0, 40)}..."`);
                console.log(`        Posted: ${reply.postedAt}`);

                if (reply.replies && reply.replies.length > 0) {
                    reply.replies.forEach((nestedReply, nestedIdx) => {
                        console.log(`        ${idx + 1}.${replyIdx + 1}.${nestedIdx + 1} [NESTED] ${nestedReply.user}: "${nestedReply.text.substring(0, 30)}..."`);
                    });
                }
            });
        }
        console.log('');
    });

    process.exit(0);
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
