import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Topics and Projects UI exposes independent knowledge and a separate non-executing POC gate', async () => {
    const [topics, projects, app, layout] = await Promise.all([
        readFile(new URL('../../src/pages/OwnerTopicsPage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/pages/ProjectsPage.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/App.jsx', import.meta.url), 'utf8'),
        readFile(new URL('../../src/components/Layout.jsx', import.meta.url), 'utf8')
    ]);
    assert.match(topics, /不需要綁定任何 repo/);
    assert.match(projects, /不會修改 repo 或執行 POC/);
    assert.match(projects, /提出隔離 POC/);
    assert.match(app, /OwnerTopicsPage/);
    assert.match(app, /ProjectsPage/);
    assert.match(layout, /label="Projects"/);
});
