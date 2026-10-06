import { supabase as defaultSupabase } from '../supabaseClient.js';
import { createReviewProposal, ensureReviewPacket } from './reviewPacketService.js';

function text(value, maxLength = 120) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function terms(value) {
    return new Set(text(value, 12_000).toLocaleLowerCase('zh-TW').split(/[^\p{L}\p{N}]+/u).filter(token => token.length >= 2));
}

export function buildFolderProposalPayload({ post, collections, sourceRevisionId }) {
    const sourceTerms = terms(`${post?.title || ''} ${post?.content || ''}`);
    const candidates = (collections || []).map(collection => {
        const nameTerms = terms(collection.name);
        const score = [...nameTerms].reduce((total, term) => total + (sourceTerms.has(term) ? 1 : 0), 0);
        return { id: collection.id, name: text(collection.name, 160), score };
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-TW'));
    const selected = candidates.find(candidate => candidate.score > 0) || null;
    return {
        source_revision_id: sourceRevisionId,
        folder_id: selected?.id || null,
        suggested_name: selected?.name || null,
        alternatives: candidates.slice(0, 3).map(({ id, name }) => ({ id, name })),
        rationale: selected
            ? `Source wording overlaps with the existing folder “${selected.name}”.`
            : 'No existing folder matched confidently; keep this source in Inbox unless the Owner chooses a folder.'
    };
}

export function buildPostLearningNotePayload({ post, sourceRevisionId }) {
    const content = text(post?.content, 12_000);
    if (content.length < 80) {
        return {
            source_revision_id: sourceRevisionId,
            note_status: 'not_needed',
            content: null,
            rationale: 'No durable learning note was inferred; Owner may record one instead.'
        };
    }
    return {
        source_revision_id: sourceRevisionId,
        note_status: 'needs_discussion',
        content: null,
        rationale: 'The source has enough material for learning, but no note is promoted until the Owner records or explicitly skips it.'
    };
}

export function normalizeTopicAssignment(value) {
    const primary = text(value?.primary_topic, 120) || null;
    const related = Array.isArray(value?.related_topics)
        ? value.related_topics.map(item => text(item, 120)).filter(Boolean)
        : [];
    const seen = new Set();
    const unique = [];
    for (const topic of related) {
        const key = topic.toLocaleLowerCase('zh-TW');
        if (primary && key === primary.toLocaleLowerCase('zh-TW')) throw new Error('related_topics must not repeat primary_topic');
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(topic);
        }
    }
    if (unique.length > 2) throw new Error('related_topics may contain at most two Topics');
    return { primary_topic: primary, related_topics: unique };
}

function hashtags(post) {
    const values = `${post?.title || ''} ${post?.content || ''}`.match(/#[\p{L}\p{N}_-]{2,80}/gu) || [];
    const unique = [];
    const seen = new Set();
    for (const tag of values) {
        const label = text(tag.slice(1), 120);
        const key = label.toLocaleLowerCase('zh-TW');
        if (label && !seen.has(key)) { seen.add(key); unique.push(label); }
        if (unique.length === 3) break;
    }
    return unique;
}

export function buildTopicProposalPayload({ post, sourceRevisionId }) {
    const labels = hashtags(post);
    return {
        source_revision_id: sourceRevisionId,
        ...normalizeTopicAssignment({ primary_topic: labels[0] || null, related_topics: labels.slice(1) }),
        rationale: labels.length
            ? 'Topic candidates come from source hashtags and still require Owner confirmation.'
            : 'No confident Topic label was inferred; Owner may add one or explicitly keep this source without a Topic.'
    };
}

export async function prepareInitialReviewProposals({ userId, sourceRevisionId, supabaseClient = defaultSupabase }) {
    if (!userId || !sourceRevisionId) throw new Error('userId and sourceRevisionId are required');
    const packet = await ensureReviewPacket({ userId, sourceRevisionId, supabaseClient });
    const { data: revision, error: revisionError } = await supabaseClient
        .from('collection_source_revisions')
        .select('id, post_id, collection_posts (id, title, content)')
        .eq('id', sourceRevisionId).eq('user_id', userId).maybeSingle();
    if (revisionError || !revision) throw new Error(`Source revision lookup failed: ${revisionError?.message || 'not found'}`);
    const { data: collections, error: collectionsError } = await supabaseClient
        .from('collection_collections').select('id, name').eq('user_id', userId).order('name', { ascending: true });
    if (collectionsError) throw new Error(`Folder lookup failed: ${collectionsError.message}`);
    const post = Array.isArray(revision.collection_posts) ? revision.collection_posts[0] : revision.collection_posts;
    const candidates = [
        ['folder_assignment', buildFolderProposalPayload({ post, collections, sourceRevisionId })],
        ['post_learning_note', buildPostLearningNotePayload({ post, sourceRevisionId })],
        ['topic_assignment', buildTopicProposalPayload({ post, sourceRevisionId })]
    ];
    const proposals = [];
    for (const [proposalType, payload] of candidates) {
        proposals.push(await createReviewProposal({
            userId,
            packetId: packet.id,
            proposalType,
            payload,
            idempotencyKey: `${sourceRevisionId}:${proposalType}:v1`,
            supabaseClient
        }));
    }
    return { packet, proposals };
}
