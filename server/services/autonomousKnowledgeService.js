import crypto from 'crypto';

import { AUTONOMY_CONFIDENCE_THRESHOLD } from './autonomyPolicyService.js';

function text(value, maxLength = 4_000) {
    return String(value ?? '').replace(/\0/g, '').slice(0, maxLength).trim();
}

function sourcePost(workflow) {
    return Array.isArray(workflow?.collection_posts)
        ? workflow.collection_posts[0]
        : workflow?.collection_posts;
}

export async function persistGeneratedTitle(post, generatedTitle, supabaseClient, source = 'hermes_preprocess') {
    const title = text(generatedTitle, 80).replace(/\s+/g, ' ');
    if (!post?.id || !post?.user_id || !title) return { persisted: false, reason: 'missing_input' };
    if (text(post.title, 500)) return { persisted: false, reason: 'source_title_present' };

    const { data, error } = await supabaseClient
        .from('collection_post_analysis')
        .update({
            generated_title: title,
            title_generated_at: new Date().toISOString(),
            title_generation_source: source
        })
        .eq('post_id', post.id)
        .eq('user_id', post.user_id)
        .is('generated_title', null)
        .select('id, generated_title')
        .maybeSingle();
    // Rolling deploys must keep the durable capture path available before the
    // additive Stage S columns are installed.
    if (error?.code === '42703') return { persisted: false, reason: 'schema_not_deployed' };
    if (error) throw new Error(`Generated title update failed: ${error.message}`);
    return data?.id
        ? { persisted: true, title: data.generated_title }
        : { persisted: false, reason: 'title_already_present' };
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
    if (!post?.user_id || !supabaseClient) return { topic: null, match: null, reason: 'missing_topic_context' };
    topicInput ||= {};
    const proposal = {
        suggested_title: text(topicInput.suggested_title || topicInput.title, 240) || null,
        slug: text(topicInput.slug, 120) || null,
        description: text(topicInput.description, 2_000) || null,
        purpose: text(topicInput.purpose, 2_000) || null,
        keywords: Array.isArray(topicInput.keywords) ? topicInput.keywords.map(item => text(item, 120)).filter(Boolean).slice(0, 30) : [],
        confidence: Math.round(Math.min(1, Math.max(0, Number(topicInput.confidence) || 0)) * 100),
        source_id: post.id,
        rationale: text(relationInput?.rationale || topicInput.rationale, 4_000) || null
    };
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
            .eq('status', 'active')
            .maybeSingle();
        if (error) throw new Error(`Topic slug lookup failed: ${error.message}`);
        topic = data;
    }

    if (!topic?.id) return { topic: null, match: null, deferred: true, reason: 'no_existing_topic', proposal };
    // Legacy agent_auto Topics are not owner-approved workspaces. Never let a
    // new source revive them merely because a caller supplied their ID or slug.
    if (topic.origin !== 'user' || topic.status !== 'active') {
        return { topic: null, match: null, deferred: true, reason: 'topic_not_user_active', proposal };
    }
    const matchType = ['duplicate', 'supports', 'extends', 'contradicts', 'related'].includes(relationInput?.kind)
        ? relationInput.kind
        : topicInput.match_type;
    const score = Math.min(100, Math.max(0, Math.round(Number(relationInput?.confidence ?? topicInput.confidence ?? 0) * 100)));
    const { data: existingMatch, error: existingMatchError } = await supabaseClient
        .from('collection_topic_source_matches')
        .select('id, topic_id, source_id, status, decision_source')
        .eq('user_id', post.user_id)
        .eq('topic_id', topic.id)
        .eq('source_id', post.id)
        .maybeSingle();
    if (existingMatchError) throw new Error(`Topic match lookup failed: ${existingMatchError.message}`);
    if (existingMatch?.decision_source === 'user'
        && ['accepted', 'rejected'].includes(existingMatch.status)) {
        return {
            topic,
            match: existingMatch,
            deferred: true,
            reason: 'existing_user_decision_preserved',
            proposal
        };
    }
    const { data: match, error: matchError } = await supabaseClient
        .from('collection_topic_source_matches')
        .upsert({
            user_id: post.user_id,
            topic_id: topic.id,
            source_id: post.id,
            match_type: matchType || 'related',
            score,
            rationale: text(relationInput?.rationale || topicInput.rationale || 'Hermes autonomous topic assignment', 4_000),
            matched_terms: topicInput?.keywords || [],
            matched_by: 'agent',
            status: 'suggested',
            decision_source: 'agent'
        }, { onConflict: 'topic_id,source_id' })
        .select('id, topic_id, source_id, match_type, score, status')
        .single();
    if (matchError) throw new Error(`Topic match persistence failed: ${matchError.message}`);
    return { topic, match, deferred: true, reason: 'user_acceptance_required', proposal };
}

function approvedCollectionIds(options = {}) {
    if (options.approvedCollectionIds instanceof Set) return options.approvedCollectionIds;
    if (Array.isArray(options.approvedCollectionIds)) return new Set(options.approvedCollectionIds);
    return new Set();
}

function minimumFolderConfidence(options = {}) {
    const configured = Number(options.minimumConfidence);
    return Number.isFinite(configured)
        ? Math.max(AUTONOMY_CONFIDENCE_THRESHOLD, configured)
        : AUTONOMY_CONFIDENCE_THRESHOLD;
}

function hasMinimumFolderConfidence(folderInput, options = {}) {
    const confidence = Number(folderInput?.confidence);
    return Number.isFinite(confidence) && confidence >= minimumFolderConfidence(options);
}

async function assignApprovedCollection(post, collection, supabaseClient, inheritance = {}) {
    if (!collection?.id || collection.user_id !== post.user_id) {
        return { collection: null, assigned: false, reason: 'collection_not_found', ...inheritance };
    }
    const updated = await supabaseClient
        .from('collection_posts')
        .update({ collection_id: collection.id })
        .eq('id', post.id)
        .eq('user_id', post.user_id)
        .is('collection_id', null)
        .select('id, collection_id')
        .maybeSingle();
    if (updated.error) throw new Error(`Collection assignment failed: ${updated.error.message}`);
    if (!updated.data?.id) {
        return {
            collection: null,
            assigned: false,
            reason: 'collection_assignment_conflict',
            ...inheritance
        };
    }
    return { collection, assigned: true, ...inheritance };
}

export async function persistFolderDecision(workflow, folderInput, supabaseClient, options = {}) {
    const post = sourcePost(workflow);
    if (!post?.id || !post?.user_id || !supabaseClient) {
        return { collection: null, assigned: false, reason: 'missing_folder_context' };
    }
    if (post.collection_id) {
        return { collection: null, assigned: false, reason: 'existing_collection_preserved' };
    }

    const approvedIds = approvedCollectionIds(options);
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
        const inheritance = {
            inherited_from_duplicate: options.duplicate?.id || null,
            inherited_from_related: options.duplicate?.id ? null : inheritedSourceId
        };
        if (!hasMinimumFolderConfidence(folderInput, options)) {
            return { collection: null, assigned: false, reason: 'folder_confidence_low', ...inheritance };
        }
        if (!approvedIds.has(inheritedCollectionId)) {
            return {
                collection: null,
                assigned: false,
                reason: 'inherited_collection_not_approved',
                ...inheritance
            };
        }
        const existing = await supabaseClient
            .from('collection_collections')
            .select('id, user_id, name, description')
            .eq('id', inheritedCollectionId)
            .eq('user_id', post.user_id)
            .maybeSingle();
        if (existing.error) throw new Error(`Duplicate collection lookup failed: ${existing.error.message}`);
        if (!existing.data) {
            return {
                collection: null,
                assigned: false,
                reason: 'collection_not_found',
                inherited_from_duplicate: options.duplicate?.id || null,
                inherited_from_related: options.duplicate?.id ? null : inheritedSourceId
            };
        }
        return assignApprovedCollection(post, existing.data, supabaseClient, {
            inherited_from_duplicate: options.duplicate?.id || null,
            inherited_from_related: options.duplicate?.id ? null : inheritedSourceId
        });
    }

    const collectionId = text(folderInput?.collection_id, 80);
    if (!collectionId) return { collection: null, assigned: false, reason: 'no_existing_collection' };
    if (!approvedIds.has(collectionId)) {
        return { collection: null, assigned: false, reason: 'collection_not_approved', requested_collection_id: collectionId };
    }
    if (!hasMinimumFolderConfidence(folderInput, options)) {
        return { collection: null, assigned: false, reason: 'folder_confidence_low', requested_collection_id: collectionId };
    }
    const { data: collection, error } = await supabaseClient
        .from('collection_collections')
        .select('id, user_id, name, description')
        .eq('user_id', post.user_id)
        .eq('id', collectionId)
        .maybeSingle();
    if (error) throw new Error(`Collection lookup failed: ${error.message}`);
    if (!collection) return { collection: null, assigned: false, reason: 'collection_not_found', requested_collection_id: collectionId };
    return assignApprovedCollection(post, collection, supabaseClient, { requested_collection_id: collectionId });
}
