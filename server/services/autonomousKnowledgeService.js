import crypto from 'crypto';

function text(value, maxLength = 4_000) {
    return String(value ?? '').replace(/\0/g, '').slice(0, maxLength).trim();
}

function sourcePost(workflow) {
    return Array.isArray(workflow?.collection_posts)
        ? workflow.collection_posts[0]
        : workflow?.collection_posts;
}

export function canonicalizeSourceUrl(value) {
    const raw = text(value, 4_000);
    if (!raw) return null;
    try {
        const url = new URL(raw);
        url.hash = '';
        for (const key of [...url.searchParams.keys()]) {
            if (/^(utm_|fbclid$|gclid$|igshid$|si$)/i.test(key)) url.searchParams.delete(key);
        }
        url.hostname = url.hostname.toLowerCase();
        if (url.protocol === 'https:' && url.port === '443') url.port = '';
        if (url.protocol === 'http:' && url.port === '80') url.port = '';
        return url.toString().replace(/\/$/, '');
    } catch {
        return raw;
    }
}

export function normalizedContentHash(post) {
    const full = post?.full_json && typeof post.full_json === 'object' ? post.full_json : {};
    const content = text(post?.content || full.content || full.text || full.raw_content, 1_000_000)
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    if (!content) return null;
    // This is only an identity key for duplicate detection, not a security
    // digest. Keep it compatible with the SQL backfill in Stage K.
    return crypto.createHash('md5').update(content, 'utf8').digest('hex');
}

async function findExistingByIdentity(post, supabaseClient) {
    if (!post?.user_id || !post?.id || !supabaseClient) return null;
    const canonicalUrl = canonicalizeSourceUrl(post.original_url);
    const contentHash = normalizedContentHash(post);
    const candidates = [];

    if (canonicalUrl) {
        const { data, error } = await supabaseClient
            .from('collection_posts')
            .select('id, original_url, canonical_url, platform, platform_post_id, title, collection_id')
            .eq('user_id', post.user_id)
            .eq('canonical_url', canonicalUrl)
            .neq('id', post.id)
            .limit(5);
        if (error && error.code !== '42703') throw new Error(`Exact URL lookup failed: ${error.message}`);
        candidates.push(...(data || []).map(item => ({ ...item, match_type: 'canonical_url' })));
    }

    if (post.platform_post_id) {
        const { data, error } = await supabaseClient
            .from('collection_posts')
            .select('id, original_url, canonical_url, platform, platform_post_id, title, collection_id')
            .eq('user_id', post.user_id)
            .eq('platform', post.platform)
            .eq('platform_post_id', post.platform_post_id)
            .neq('id', post.id)
            .limit(5);
        if (error) throw new Error(`Platform post lookup failed: ${error.message}`);
        candidates.push(...(data || []).map(item => ({ ...item, match_type: 'platform_post_id' })));
    }

    if (contentHash) {
        const { data, error } = await supabaseClient
            .from('collection_posts')
            .select('id, original_url, canonical_url, platform, platform_post_id, title, collection_id')
            .eq('user_id', post.user_id)
            .eq('content_hash', contentHash)
            .neq('id', post.id)
            .limit(5);
        if (error && error.code !== '42703') throw new Error(`Exact content lookup failed: ${error.message}`);
        candidates.push(...(data || []).map(item => ({ ...item, match_type: 'content_hash' })));
    }

    return [...new Map(candidates.map(item => [item.id, item])).values()][0] || null;
}

export async function persistSourceIdentity(workflow, supabaseClient) {
    const post = sourcePost(workflow);
    if (!post?.id || !supabaseClient) throw new Error('Workflow post and Supabase client are required');
    const canonicalUrl = canonicalizeSourceUrl(post.original_url);
    const contentHash = normalizedContentHash(post);
    const update = { canonical_url: canonicalUrl, content_hash: contentHash };
    const { error } = await supabaseClient
        .from('collection_posts')
        .update(update)
        .eq('id', post.id)
        .eq('user_id', post.user_id);
    if (error && error.code !== '42703') throw new Error(`Source identity update failed: ${error.message}`);
    const duplicate = await findExistingByIdentity(post, supabaseClient);
    return { canonical_url: canonicalUrl, content_hash: contentHash, exact_duplicate: duplicate };
}

export async function persistTopicDecision(workflow, topicInput, relationInput, supabaseClient) {
    const post = sourcePost(workflow);
    if (!topicInput?.title || !post?.user_id || !supabaseClient) return { topic: null, match: null };
    const topicConfidence = Number(topicInput.confidence || 0);
    if (!Number.isFinite(topicConfidence) || topicConfidence < 0.85) {
        return { topic: null, match: null, deferred: true, reason: 'topic_confidence_low' };
    }

    let topic = null;
    if (topicInput.topic_id) {
        const { data, error } = await supabaseClient
            .from('collection_topics')
            .select('id, user_id, slug, title, status, origin')
            .eq('id', topicInput.topic_id)
            .eq('user_id', post.user_id)
            .maybeSingle();
        if (error) throw new Error(`Topic lookup failed: ${error.message}`);
        topic = data;
    }

    if (!topic && topicInput.slug) {
        const { data, error } = await supabaseClient
            .from('collection_topics')
            .select('id, user_id, slug, title, status, origin')
            .eq('user_id', post.user_id)
            .eq('slug', topicInput.slug)
            .maybeSingle();
        if (error) throw new Error(`Topic slug lookup failed: ${error.message}`);
        topic = data;
    }

    if (!topic) {
        const { data, error } = await supabaseClient
            .from('collection_topics')
            .insert({
                user_id: post.user_id,
                slug: topicInput.slug || `hermes-${post.id.slice(0, 12)}`,
                title: topicInput.title,
                description: topicInput.description || null,
                purpose: topicInput.purpose || null,
                keywords: topicInput.keywords || [],
                origin: 'agent_auto',
                status: 'active',
                agent_confidence: Math.round(topicConfidence * 100),
                proposal_evidence: { source_ids: [post.id], rationale: topicInput.rationale || null }
            })
            .select('id, user_id, slug, title, status, origin')
            .single();
        if (error) throw new Error(`Topic creation failed: ${error.message}`);
        topic = data;
    }

    if (!topic?.id) return { topic: null, match: null };
    const matchType = ['duplicate', 'supports', 'extends', 'contradicts', 'related'].includes(relationInput?.kind)
        ? relationInput.kind
        : topicInput.match_type;
    const score = Math.min(100, Math.max(0, Math.round(Number(relationInput?.confidence ?? topicInput.confidence ?? 0) * 100)));
    const { data: match, error: matchError } = await supabaseClient
        .from('collection_topic_source_matches')
        .upsert({
            user_id: post.user_id,
            topic_id: topic.id,
            source_id: post.id,
            match_type: matchType || 'related',
            score,
            rationale: text(relationInput?.rationale || topicInput.rationale || 'Hermes autonomous topic assignment', 4_000),
            matched_terms: topicInput.keywords || [],
            matched_by: 'agent',
            status: score >= 85 ? 'accepted' : 'suggested'
        }, { onConflict: 'topic_id,source_id' })
        .select('id, topic_id, source_id, match_type, score, status')
        .single();
    if (matchError) throw new Error(`Topic match persistence failed: ${matchError.message}`);
    return { topic, match };
}

export async function persistFolderDecision(workflow, folderInput, supabaseClient, options = {}) {
    const post = sourcePost(workflow);
    if (!post?.id || !post?.user_id || !supabaseClient) {
        return { collection: null, assigned: false };
    }
    let inheritedSourceId = options.duplicate?.id || null;
    let inheritedCollectionId = options.duplicate?.collection_id || null;
    if (!inheritedCollectionId && Array.isArray(options.relatedMatches) && options.relatedMatches.length) {
        const relatedIds = options.relatedMatches
            .map(match => typeof match === 'string' ? match : match?.source_id || match?.id)
            .map(value => text(value, 80))
            .filter(Boolean)
            .slice(0, 20);
        if (relatedIds.length) {
            const related = await supabaseClient
                .from('collection_posts')
                .select('id, collection_id')
                .eq('user_id', post.user_id)
                .in('id', relatedIds)
                .neq('id', post.id)
                .not('collection_id', 'is', null)
                .limit(1)
                .maybeSingle();
            if (related.error) throw new Error(`Related collection lookup failed: ${related.error.message}`);
            inheritedCollectionId = related.data?.collection_id || null;
            inheritedSourceId = related.data?.id || null;
        }
    }
    if (inheritedCollectionId) {
        const existing = await supabaseClient
            .from('collection_collections')
            .select('id, user_id, name, description')
            .eq('id', inheritedCollectionId)
            .eq('user_id', post.user_id)
            .maybeSingle();
        if (existing.error) throw new Error(`Duplicate collection lookup failed: ${existing.error.message}`);
        if (!existing.data) {
            return { collection: null, assigned: false, inherited_from_duplicate: options.duplicate.id || null };
        }
        const inherited = await supabaseClient
            .from('collection_posts')
            .update({ collection_id: inheritedCollectionId })
            .eq('id', post.id)
            .eq('user_id', post.user_id)
            .select('id, collection_id')
            .single();
        if (inherited.error) throw new Error(`Duplicate collection inheritance failed: ${inherited.error.message}`);
        return {
            collection: existing.data,
            assigned: true,
            inherited_from_duplicate: options.duplicate?.id || null,
            inherited_from_related: options.duplicate?.id ? null : inheritedSourceId
        };
    }
    if (!folderInput?.domain || folderInput.domain === '待整理') {
        return { collection: null, assigned: false };
    }
    const name = text(folderInput.domain, 255);
    let { data: collection, error } = await supabaseClient
        .from('collection_collections')
        .select('id, user_id, name, description')
        .eq('user_id', post.user_id)
        .eq('name', name)
        .maybeSingle();
    if (error) throw new Error(`Collection lookup failed: ${error.message}`);
    if (!collection) {
        const created = await supabaseClient
            .from('collection_collections')
            .insert({ user_id: post.user_id, name, description: 'Hermes 自動建立的媒體分類資料夾' })
            .select('id, user_id, name, description')
            .single();
        if (created.error) throw new Error(`Collection creation failed: ${created.error.message}`);
        collection = created.data;
    }
    const updated = await supabaseClient
        .from('collection_posts')
        .update({ collection_id: collection.id })
        .eq('id', post.id)
        .eq('user_id', post.user_id)
        .select('id, collection_id')
        .single();
    if (updated.error) throw new Error(`Collection assignment failed: ${updated.error.message}`);
    return { collection, assigned: true };
}
