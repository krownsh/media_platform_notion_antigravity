import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthorColorIndex, getAuthorInitial } from '../../src/utils/authorInitial.js';

test('author initials support Latin, CJK, emoji graphemes, and fallbacks', () => {
    assert.equal(getAuthorInitial(' alice '), 'A');
    assert.equal(getAuthorInitial('王小明'), '王');
    assert.equal(getAuthorInitial('👩‍💻 Builder'), '👩‍💻');
    assert.equal(getAuthorInitial(''), 'U');
    assert.equal(getAuthorInitial(null), 'U');
});

test('author avatar colors are stable and bounded', () => {
    assert.equal(getAuthorColorIndex('Alice', 6), getAuthorColorIndex('Alice', 6));
    assert.ok(getAuthorColorIndex('Alice', 6) >= 0);
    assert.ok(getAuthorColorIndex('Alice', 6) < 6);
});
