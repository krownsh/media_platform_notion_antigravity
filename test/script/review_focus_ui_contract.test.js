import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const panel = fs.readFileSync(path.join(root, 'src/components/ReviewFocusPanel.jsx'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/pages/HomePage.jsx'), 'utf8');

test('Focus Mode explains current stage, why, one next action, defer, and resume', () => {
    for (const requirement of ['目前階段', '為什麼現在要處理', '下一步', '來源依據', '稍後處理', '繼續處理']) {
        assert.match(panel, new RegExp(requirement));
    }
    assert.match(home, /ReviewFocusPanel/);
    assert.doesNotMatch(panel, /Knowledge Space/);
});
