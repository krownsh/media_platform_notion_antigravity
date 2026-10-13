import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const orchestratorSource = fs.readFileSync(
    path.join(projectRoot, 'server', 'services', 'orchestrator.js'),
    'utf8'
);
const serverSource = fs.readFileSync(
    path.join(projectRoot, 'server', 'index.js'),
    'utf8'
);
const finalizationSource = fs.readFileSync(
    path.join(projectRoot, 'server', 'services', 'captureFinalizationService.js'),
    'utf8'
);

test('data acquisition is crawler-only', () => {
    assert.doesNotMatch(orchestratorSource, /socialApiService/);
    assert.doesNotMatch(orchestratorSource, /source:\s*['"]api['"]/);
    assert.match(orchestratorSource, /scrapeThreadsPost\(url\)/);
    assert.match(orchestratorSource, /scrapeTwitterPost\(url\)/);
    assert.match(orchestratorSource, /crawlerService\.crawlPost\(url, platform\)/);
});

test('the capture worker is the only runtime caller of the crawler orchestrator', () => {
    assert.doesNotMatch(serverSource, /orchestrator\.processUrl\(url\)/);
    assert.match(serverSource, /app\.use\('\/api\/captures', requireApiAuth, captureRouter\)/);
});

test('post finalization is tenant-aware and routed through the atomic database RPC', () => {
    assert.doesNotMatch(orchestratorSource, /upsertPost\(/);
    assert.doesNotMatch(orchestratorSource, /collection_posts/);
    assert.match(finalizationSource, /rpc\('finalize_collection_capture'/);
    assert.doesNotMatch(serverSource, /finalizeCapture\(userId/);
});
