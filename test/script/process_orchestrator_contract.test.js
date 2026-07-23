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

test('data acquisition is crawler-only', () => {
    assert.doesNotMatch(orchestratorSource, /socialApiService/);
    assert.doesNotMatch(orchestratorSource, /source:\s*['"]api['"]/);
    assert.match(orchestratorSource, /scrapeThreadsPost\(url\)/);
    assert.match(orchestratorSource, /scrapeTwitterPost\(url\)/);
    assert.match(orchestratorSource, /crawlerService\.crawlPost\(url, platform\)/);
});

test('/api/process keeps the n8n-facing route and response contract', () => {
    assert.match(serverSource, /app\.post\(['"]\/api\/process['"]/);
    assert.match(serverSource, /const \{ url, userId \} = req\.body/);
    assert.match(serverSource, /orchestrator\.processUrl\(url, userId\)/);
    assert.match(serverSource, /res\.json\(result\)/);
});
