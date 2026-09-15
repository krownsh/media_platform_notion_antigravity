const normalizeText = (value, maxLength = 240) => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const sourceLabel = (source) => normalizeText(source?.title, 180)
    || normalizeText(source?.original_url, 180)
    || `來源 ${source?.id || '未知'}`;

export function buildTopicKnowledgeAggregate({ matches = [], sources = [] } = {}) {
    const accepted = matches.filter(match => match?.status === 'accepted' && match?.source_id);
    const sourceById = new Map(sources.map(source => [source.id, source]));
    const sourceIds = [...new Set(accepted.map(match => match.source_id))].sort();
    const concepts = [];
    const seenConcepts = new Set();

    for (const match of accepted) {
        for (const term of Array.isArray(match.matched_terms) ? match.matched_terms : []) {
            const normalized = normalizeText(term, 120);
            const key = normalized.toLocaleLowerCase();
            if (normalized && !seenConcepts.has(key)) {
                seenConcepts.add(key);
                concepts.push(normalized);
            }
        }
    }

    return {
        knowledge_summary: sourceIds.length
            ? `已接受 ${sourceIds.length} 個來源：${sourceIds.map(id => sourceLabel(sourceById.get(id))).join('；')}`
            : '',
        knowledge_concepts: concepts,
        knowledge_open_questions: [],
        knowledge_source_ids: sourceIds,
        knowledge_source_count: sourceIds.length
    };
}

export function aggregateChanged(topic, aggregate) {
    return JSON.stringify({
        knowledge_summary: topic?.knowledge_summary || '',
        knowledge_concepts: topic?.knowledge_concepts || [],
        knowledge_open_questions: topic?.knowledge_open_questions || [],
        knowledge_source_ids: topic?.knowledge_source_ids || [],
        knowledge_source_count: topic?.knowledge_source_count || 0
    }) !== JSON.stringify(aggregate);
}


export async function rebuildTopicKnowledgeAggregate({ topicId, userId, supabaseClient }) {
    const { data: topic, error: topicError } = await supabaseClient
        .from('collection_topics')
        .select('id, user_id, knowledge_summary, knowledge_concepts, knowledge_open_questions, knowledge_source_ids, knowledge_source_count, knowledge_revision')
        .eq('id', topicId)
        .eq('user_id', userId)
        .maybeSingle();
    if (topicError) throw new Error(`Topic aggregate lookup failed: ${topicError.message}`);
    if (!topic) return { changed: false, missing: true, aggregate: null, topic: null };

    const { data: matches, error: matchError } = await supabaseClient
        .from('collection_topic_source_matches')
        .select('source_id, status, matched_terms')
        .eq('topic_id', topic.id)
        .eq('user_id', userId)
        .eq('status', 'accepted');
    if (matchError) throw new Error(`Topic evidence lookup failed: ${matchError.message}`);

    const sourceIds = [...new Set((matches || []).map(match => match.source_id).filter(Boolean))];
    let sources = [];
    if (sourceIds.length) {
        const { data, error } = await supabaseClient
            .from('collection_posts')
            .select('id, title, original_url')
            .eq('user_id', userId)
            .in('id', sourceIds);
        if (error) throw new Error(`Topic source lookup failed: ${error.message}`);
        sources = data || [];
    }

    const aggregate = buildTopicKnowledgeAggregate({ matches, sources });
    if (!aggregateChanged(topic, aggregate)) return { changed: false, missing: false, aggregate, topic };

    const { data: updated, error: updateError } = await supabaseClient
        .from('collection_topics')
        .update({
            ...aggregate,
            knowledge_revision: topic.knowledge_revision + 1,
            knowledge_aggregated_at: new Date().toISOString()
        })
        .eq('id', topic.id)
        .eq('user_id', userId)
        .eq('knowledge_revision', topic.knowledge_revision)
        .select('id, knowledge_summary, knowledge_concepts, knowledge_open_questions, knowledge_source_ids, knowledge_source_count, knowledge_revision, knowledge_aggregated_at')
        .maybeSingle();
    if (updateError) throw new Error(`Topic aggregate update failed: ${updateError.message}`);
    if (!updated) {
        const error = new Error('Topic aggregate changed concurrently; retry the review action');
        error.code = 'TOPIC_AGGREGATE_CONFLICT';
        throw error;
    }
    return { changed: true, missing: false, aggregate, topic: updated };
}
