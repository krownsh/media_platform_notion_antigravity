import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const panel = fs.readFileSync(path.join(root, 'src/components/ReviewFocusPanel.jsx'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/pages/HomePage.jsx'), 'utf8');

test('Focus Mode starts with the identifiable source and turns one candidate into a concrete decision', () => {
    for (const requirement of ['現在處理這一篇', 'SourcePreview', '查看完整貼文', '候選重點', '為什麼現在處理', '接受後會改變什麼', '稍後處理', '繼續處理']) {
        assert.match(panel, new RegExp(requirement));
    }
    assert.match(panel, /選擇資料夾後確認/);
    assert.match(panel, /Inbox（暫不分類）/);
    assert.match(panel, /尚未找到可信的自動分類/);
    assert.match(home, /ReviewFocusPanel/);
    assert.doesNotMatch(panel, /Knowledge Space/);
});
