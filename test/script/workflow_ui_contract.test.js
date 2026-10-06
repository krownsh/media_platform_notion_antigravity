import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = relativePath => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('posts API projects independent parallel tracks from workflow context', () => {
    const server = read('server/index.js');

    assert.match(server, /normalizeParallelTracks/);
    assert.match(server, /parallelTracks:\s*normalizeParallelTracks\(post\.collection_post_workflows\?\.\[0\]\?\.context\)/);
    assert.doesNotMatch(server, /parallelTracks:[\s\S]{0,180}outbox/);
});
