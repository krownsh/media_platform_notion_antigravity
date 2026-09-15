import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('topic card presents controlled aggregate separately from human description', async () => {
    const page = await readFile(new URL('../../src/pages/TopicsPage.jsx', import.meta.url), 'utf8');

    assert.match(page, /aria-label="知識彙整"/);
    assert.match(page, /knowledge_revision/);
    assert.match(page, /knowledge_source_count/);
    assert.match(page, /knowledge_summary/);
    assert.match(page, /knowledge_concepts/);
    assert.match(page, /尚未彙整：接受來源後會在此建立可追溯摘要。/);
});
