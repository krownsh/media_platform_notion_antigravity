import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const serverSource = fs.readFileSync(path.join(projectRoot, 'server', 'index.js'), 'utf8');
const batchProcessorSource = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'batchProcessor.js'), 'utf8');
const twitterCrawlerSource = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'crawlerService', 'twitterCrawler.js'), 'utf8');
const imageWorkflowPageSource = fs.readFileSync(path.join(projectRoot, 'src', 'pages', 'ImageWorkflowPage.jsx'), 'utf8');
const serverEnvTemplate = fs.readFileSync(path.join(projectRoot, 'server', '.env.example'), 'utf8');
const twitterReference = fs.readFileSync(path.join(projectRoot, 'server', 'fixtures', 'crawler', 'twitter', 'example1', 'doc.md'), 'utf8');

test('only /api/process accepts the mapped n8n key; interactive routes require a Supabase JWT', () => {
    assert.match(serverSource, /app\.post\(['"]\/api\/process['"], requireApiAuth/);

    for (const route of [
        '/api/posts',
        '/api/stats',
        '/api/analyze-post',
        '/api/rewrite',
        '/api/remix',
        '/api/generate-image',
        '/api/image-workflow',
        '/api/publish',
        '/api/batch-classify'
    ]) {
        assert.match(serverSource, new RegExp(`app\\.use\\(['"]${route.replaceAll('/', '\\/')}['"], requireSupabaseJwt\\)`));
    }
});

test('Gemini-dependent image workflow is explicitly retired and cannot receive a body userId', () => {
    assert.match(serverSource, /imageWorkflowRetired/);
    assert.match(serverSource, /status\(410\)/);
    assert.doesNotMatch(serverSource, /const \{ postId, imageUrl, prompt, userId \} = req\.body/);
    assert.doesNotMatch(imageWorkflowPageSource, /user-id-placeholder/);
});

test('batch classification is tenant-scoped and X crawler obtains credentials from env without logging guest tokens', () => {
    assert.match(batchProcessorSource, /\.eq\('user_id', userId\)/);
    assert.match(serverSource, /batchClassify\(\{ ruleOnly, limit: boundedLimit, userId \}\)/);
    assert.match(twitterCrawlerSource, /TWITTER_PUBLIC_BEARER_TOKEN/);
    assert.doesNotMatch(twitterCrawlerSource, /Got guest token:\s*\$\{/);
});

test('tracked server templates and crawler references contain placeholders rather than credentials', () => {
    assert.match(serverEnvTemplate, /SUPABASE_SERVICE_KEY=replace-with/);
    assert.doesNotMatch(serverEnvTemplate, /eyJ[a-zA-Z0-9_-]{20,}/);
    assert.match(twitterReference, /Bearer <TWITTER_PUBLIC_BEARER_TOKEN>/);
});

test('database-backed routes fail explicitly instead of returning mock success data', () => {
    assert.match(serverSource, /return res\.status\(503\)\.json\(\{ error: 'Database service is not configured' \}\)/);
    assert.doesNotMatch(serverSource, /return res\.json\(\{ posts: \[\], collections: \[\] \}\)/);
    assert.doesNotMatch(serverSource, /return res\.json\(\{ annotations: \[\] \}\)/);
});
