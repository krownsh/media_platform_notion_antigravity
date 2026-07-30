const STOP_WORDS = new Set(['about', 'after', 'and', 'are', 'for', 'from', 'have', 'into', 'that', 'the', 'this', 'with', 'your', '以及', '一個', '可以', '我們', '相關', '內容', '主題']);

function termsFrom(value) {
    if (!value) return [];
    return String(value)
        .toLowerCase()
        .split(/[^\p{L}\p{N}._-]+/u)
        .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
}

function sourceText(source) {
    const analysis = source.analysis || source.collection_post_analysis?.[0] || {};
    return [
        source.title,
        source.content,
        source.original_url,
        ...(source.source_domains || []),
        ...(analysis.tags || [])
    ].filter(Boolean).join(' ').toLowerCase();
}

/**
 * Returns explainable, non-persistent Topic match suggestions.
 * It deliberately never creates a Topic or accepts a match on the user's behalf.
 */
export function suggestTopicMatches(source, topics) {
    if (!source || !Array.isArray(topics)) return [];

    const text = sourceText(source);
    if (!text) return [];

    return topics
        .filter((topic) => topic.status === 'active')
        .map((topic) => {
            const terms = [...new Set([
                ...termsFrom(topic.title),
                ...termsFrom(topic.description),
                ...(topic.keywords || []).flatMap(termsFrom)
            ])];
            const matchedTerms = terms.filter((term) => text.includes(term));
            const score = Math.min(100, matchedTerms.reduce((total, term) => total + (term.length >= 5 ? 24 : 16), 0));

            if (score < 20) return null;

            return {
                topic_id: topic.id,
                topic_title: topic.title,
                match_type: score >= 64 ? 'supports' : 'related',
                score,
                matched_terms: matchedTerms,
                matched_by: 'rule',
                rationale: `Matched topic terms: ${matchedTerms.join(', ')}`,
                status: 'suggested'
            };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score);
}
