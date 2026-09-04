import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sql = fs.readFileSync(path.join(root, 'database/deployments/stage_o_stop_auto_container_creation.sql'), 'utf8');

test('remote preprocess is link-only and retains classification suggestions', () => {
    assert.match(sql, /classification_suggestions/);
    assert.match(sql, /v_folder_input\s*->>\s*'collection_id'/);
    assert.match(sql, /v_topic_input\s*->>\s*'topic_id'/);
    assert.doesNotMatch(sql, /insert into public\.collection_collections/i);
    assert.doesNotMatch(sql, /insert into public\.collection_topics/i);
});

test('remote preprocess retains the Stage M lifecycle outside container decisions', () => {
    assert.match(sql, /collection_post_analysis/);
    assert.match(sql, /canonical_url/);
    assert.match(sql, /platform_post_id/);
    assert.match(sql, /content_hash/);
    assert.match(sql, /network\/Secrets POC boundary|network\/Secrets POC/i);
    assert.match(sql, /review_request/);
    assert.match(sql, /vault_sync/);
    assert.match(sql, /action_plan/);
    assert.match(sql, /revoke all on function[\s\S]+grant execute on function[\s\S]+service_role/i);
});
