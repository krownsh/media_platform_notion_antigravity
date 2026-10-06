import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('physical legacy retirement stays explicitly owner-approved and evidence-gated', async () => {
    const manifest = await readFile(new URL('../../docs/architecture/legacy-physical-retirement-manifest.md', import.meta.url), 'utf8');
    assert.match(manifest, /No deletion or schema change is authorized/i);
    assert.match(manifest, /Candidate retirement batches/);
    assert.match(manifest, /Mandatory evidence before any physical removal/);
    assert.match(manifest, /explicit per-table Owner approval/);
    assert.match(manifest, /collection_source_revisions/);
});
