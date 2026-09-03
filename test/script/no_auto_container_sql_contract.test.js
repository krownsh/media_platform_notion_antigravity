import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sql = fs.readFileSync(path.join(root, 'database/deployments/stage_o_stop_auto_container_creation.sql'), 'utf8');

test('remote preprocess is link-only and retains classification suggestions', () => {
    assert.match(sql, /classification_suggestions/);
    assert.match(sql, /folder,collection_id/);
    assert.match(sql, /topic,topic_id/);
    assert.doesNotMatch(sql, /insert into public\.collection_collections/i);
    assert.doesNotMatch(sql, /insert into public\.collection_topics/i);
});
