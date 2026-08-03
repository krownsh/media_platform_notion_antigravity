import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const deployment = fs.readFileSync(path.join(projectRoot, 'database', 'deployments', 'stage_f_private_image_captures.sql'), 'utf8');
const finalizer = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'captureFinalizationService.js'), 'utf8');
const orchestrator = fs.readFileSync(path.join(projectRoot, 'server', 'services', 'orchestrator.js'), 'utf8');

test('image captures use private Storage and a service-role-only enqueue RPC', () => {
    assert.match(deployment, /alter table public\.collection_posts enable row level security/);
    assert.match(deployment, /'collection_capture_uploads'[\s\S]+false[\s\S]+15728640/);
    assert.match(deployment, /input_type in \('url', 'image'\)/);
    assert.match(deployment, /create or replace function public\.enqueue_collection_image_capture_request/);
    assert.match(deployment, /revoke all on function public\.enqueue_collection_image_capture_request[\s\S]+from public, anon, authenticated/);
    assert.match(deployment, /grant execute on function public\.enqueue_collection_image_capture_request[\s\S]+to service_role/);
});

test('capture idempotency keys cannot resolve to a request of another input type', () => {
    assert.match(deployment, /create or replace function public\.enqueue_collection_capture_request[\s\S]+v_request\.input_type <> 'url'/);
    assert.match(deployment, /create or replace function public\.enqueue_collection_image_capture_request[\s\S]+v_request\.input_type <> 'image'/);
});

test('Hermes handoff receives stable Storage references, not temporary signed URLs', () => {
    assert.match(deployment, /'source_type'/);
    assert.match(deployment, /'media', coalesce\(p_media/);
    assert.match(deployment, /storage_bucket/);
    assert.match(deployment, /storage_path/);
    assert.match(deployment, /create or replace function public\.record_collection_image_analysis/);
    assert.match(deployment, /grant execute on function public\.record_collection_image_analysis\(uuid, text, jsonb\)[\s\S]+to service_role/);
});

test('new capture finalization discards remote author avatars', () => {
    assert.match(finalizer, /author_avatar_url: null/);
    assert.doesNotMatch(finalizer, /author_avatar_url: data\.avatar/);
    assert.doesNotMatch(orchestrator, /data\.avatar = await this\.uploadImageToBucket/);
});
