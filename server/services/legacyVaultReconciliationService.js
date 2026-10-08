export async function reconcileLegacyPostCandidates({ inventory = [], loadPosts }) {
    if (typeof loadPosts !== 'function') throw new Error('loadPosts is required');
    const grouped = new Map();
    for (const item of inventory) {
        if (item?.candidateKind !== 'post_candidate' || !item.postId) continue;
        const group = grouped.get(item.postId) || [];
        group.push(item);
        grouped.set(item.postId, group);
    }
    const ids = [...grouped.keys()].sort();
    const posts = await loadPosts(ids);
    const byId = new Map((posts || []).map(post => [post.id, post]));
    return ids.map(postId => {
        const records = grouped.get(postId).slice().sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        const post = byId.get(postId) || null;
        return {
            postId,
            status: post ? 'ready_for_owner_review' : 'unmatched_post',
            post,
            legacyPaths: records.map(record => record.relativePath),
            legacyHashes: records.map(record => record.sha256)
        };
    });
}
