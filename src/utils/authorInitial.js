const FALLBACK_INITIAL = 'U';

export function getAuthorInitial(value) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name) return FALLBACK_INITIAL;

    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        const first = segmenter.segment(name)[Symbol.iterator]().next().value?.segment;
        if (first) return first.toLocaleUpperCase();
    }

    return Array.from(name)[0]?.toLocaleUpperCase() || FALLBACK_INITIAL;
}

export function getAuthorColorIndex(value, paletteSize) {
    const name = typeof value === 'string' ? value.trim() : '';
    const size = Number.isInteger(paletteSize) && paletteSize > 0 ? paletteSize : 1;
    let hash = 0;
    for (const character of Array.from(name)) {
        hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
    }
    return hash % size;
}
