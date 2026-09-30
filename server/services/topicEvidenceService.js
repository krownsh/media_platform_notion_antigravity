function sourceFromMatch(match) {
    const post = Array.isArray(match?.collection_posts)
        ? match.collection_posts[0]
        : match?.collection_posts;
    if (!post?.id) return null;
    return {
        id: post.id,
        title: post.title || null,
        rationale: match.rationale || null
    };
}

export function attachAcceptedTopicSources(topics, matches) {
    const sourcesByTopic = new Map();
    for (const match of matches || []) {
        if (match?.status !== 'accepted' || !match.topic_id) continue;
        const source = sourceFromMatch(match);
        if (!source) continue;
        const sources = sourcesByTopic.get(match.topic_id) || [];
        sources.push(source);
        sourcesByTopic.set(match.topic_id, sources);
    }

    return (topics || []).map((topic) => {
        const acceptedSources = sourcesByTopic.get(topic.id) || [];
        return {
            ...topic,
            accepted_source_count: acceptedSources.length,
            accepted_sources: acceptedSources
        };
    });
}
