import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const serverSource = fs.readFileSync(path.join(projectRoot, 'server', 'index.js'), 'utf8');
const twitterCrawlerSource = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'crawlerService', 'twitterCrawler.js'), 'utf8');
const serverEnvTemplate = fs.readFileSync(path.join(projectRoot, 'server', '.env.example'), 'utf8');
const twitterReference = fs.readFileSync(path.join(projectRoot, 'server', 'fixtures', 'crawler', 'twitter', 'example1', 'doc.md'), 'utf8');

test('only capture endpoints accept the mapped n8n key', () => {
    assert.match(serverSource, /authorization\.match\(\/\^Bearer\\s\+\(\.\+\)\$\/i\)/);
    assert.match(serverSource, /app\.post\(['"]\/api\/process['"], requireApiAuth, createProcessUrlHandler\(\)\)/);

    for (const route of ['/api/posts', '/api/stats']) {
        assert.match(serverSource, new RegExp(`app\\.use\\(['"]${route.replaceAll('/', '\\/')}['"], requireSupabaseJwt\\)`));
    }
    assert.match(serverSource, /app\.get\('\/api\/activity', requireSupabaseJwt/);
    assert.doesNotMatch(serverSource, /legacyCollectionRouteRetired|imageWorkflowRetired|publicationRetired/);
});

test('X crawler obtains credentials from env without logging guest tokens', () => {
    assert.doesNotMatch(serverSource, /batchClassify\(/);
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
