import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), '..', '..');
const serverSource = fs.readFileSync(path.join(projectRoot, 'server', 'index.js'), 'utf8');

test('Topic APIs require a JWT and only operate within the authenticated tenant', () => {
    assert.match(serverSource, /app\.use\(['"]\/api\/topics['"], requireSupabaseJwt\)/);
    assert.match(serverSource, /app\.post\(['"]\/api\/topics\/matches\/dry-run['"]/);
    assert.match(serverSource, /\.from\('collection_topics'\)[\s\S]+\.eq\('user_id', getAuthenticatedUserId\(req\)\)/);
    assert.match(serverSource, /\.from\('collection_posts'\)[\s\S]+\.eq\('user_id', userId\)/);
    assert.match(serverSource, /origin: 'user',[\s\S]+status: 'active'/);
    assert.match(serverSource, /suggestTopicMatches\(source, topics \|\| \[\]\)/);
    assert.match(serverSource, /attachAcceptedTopicSources\(topics, acceptedMatches \|\| \[\]\)/);
    assert.match(serverSource, /\.from\('collection_topic_source_matches'\)[\s\S]+\.eq\('status', 'accepted'\)/);
});

test('topic lifecycle is owner-editable, archivable, and removes a source by preserving a rejected decision', () => {
    assert.match(serverSource, /app\.patch\('\/api\/topics\/:topicId'/);
    assert.match(serverSource, /\['active', 'archived'\]\.includes\(status\)/);
    assert.match(serverSource, /\.eq\('origin', 'user'\)/);
    assert.match(serverSource, /\['accepted', 'rejected'\]\.includes\(status\)/);
});
