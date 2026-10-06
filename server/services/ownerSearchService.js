import { supabase as defaultSupabase } from '../supabaseClient.js';

const MAX_TEXT = 120_000;

function text(value, limit = 12_000) {
    return String(value ?? '').replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function unique(values, limit = 32) {
    const result = [];
    const seen = new Set();
    for (const value of values || []) {
        const normalized = text(value, 500);
        const key = normalized.toLocaleLowerCase('zh-TW');
        if (!normalized || seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
        if (result.length >= limit) break;
    }
    return result;
}

function relation(row, name) {
    const value = row?.[name];
    return Array.isArray(value) ? value[0] : value;
}

export function buildOwnerSearchDocument({ post, sourceRevision, learningNote, topicLinks = [], topicRevisions = [], projectReferences = [], proposals = [] }) {
    const rawParts = [
        post?.title, post?.author_name, post?.platform, post?.original_url, post?.content,
        sourceRevision?.source_payload?.post?.content,
        ...(sourceRevision?.source_payload?.comments || []).flatMap(comment => [comment.author_name, comment.content])
    ];
    const formalParts = [];
    const formalReasons = [];
    if (learningNote?.note_status === 'recorded' && text(learningNote.content)) {
        formalParts.push(learningNote.content);
        formalReasons.push('post_learning_note');
    }
    for (const link of topicLinks) {
        const topic = relation(link, 'owner_topics');
        if (topic?.label) formalParts.push(topic.label);
    }
    if (topicLinks.length) formalReasons.push('topic_assignment');
    for (const revision of topicRevisions) {
        const topic = relation(revision, 'owner_topics');
        formalParts.push(topic?.label, revision.summary, ...(revision.claims || []), ...(revision.open_questions || []));
    }
    if (topicRevisions.length) formalReasons.push('topic_knowledge');
    for (const reference of projectReferences) {
        const topic = relation(reference, 'owner_topics');
        const project = relation(reference, 'owner_project_catalog');
        formalParts.push(topic?.label, project?.title, project?.description, project?.reference, reference.rationale);
    }
    if (projectReferences.length) formalReasons.push('project_reference');

    const candidateParts = [];
    const candidateReasons = [];
    for (const proposal of proposals) {
        if (!['pending', 'proposed'].includes(proposal?.status)) continue;
        const payload = proposal.payload || {};
        if (proposal.proposal_type === 'folder_assignment') {
            candidateParts.push(payload.suggested_name, ...(payload.alternatives || []).map(item => item?.name), payload.rationale);
            candidateReasons.push('candidate_folder');
        } else if (proposal.proposal_type === 'post_learning_note') {
            candidateParts.push(payload.content, payload.rationale);
            candidateReasons.push('candidate_post_learning_note');
        } else if (proposal.proposal_type === 'topic_assignment') {
            candidateParts.push(payload.primary_topic, ...(payload.related_topics || []), payload.rationale);
            candidateReasons.push('candidate_topic_assignment');
        } else if (proposal.proposal_type === 'topic_knowledge_delta') {
            candidateParts.push(...(payload.topics || []).flatMap(topic => [topic?.label, topic?.summary, ...(topic?.claims || []), ...(topic?.open_questions || [])]), payload.rationale);
            candidateReasons.push('candidate_topic_knowledge');
        } else if (proposal.proposal_type === 'project_reference') {
            candidateParts.push(...(payload.topic_labels || []), payload.rationale);
            candidateReasons.push('candidate_project_reference');
        }
    }

    return {
        post_id: post?.id,
        user_id: post?.user_id,
        source_revision_id: sourceRevision?.id || null,
        source_quality: sourceRevision?.capture_quality || null,
        title: text(post?.title, 500),
        raw_text: unique(rawParts).join('\n').slice(0, MAX_TEXT),
        formal_text: unique(formalParts).join('\n').slice(0, MAX_TEXT),
        candidate_text: unique(candidateParts).join('\n').slice(0, MAX_TEXT),
        formal_reasons: unique(formalReasons),
        candidate_reasons: unique(candidateReasons)
    };
}

async function maybeRows(query) {
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function loadOwnerSearchInputs({ userId, postId, sourceRevisionId = null, supabaseClient = defaultSupabase }) {
    const { data: post, error: postError } = await supabaseClient
        .from('collection_posts').select('id, user_id, platform, original_url, title, author_name, content')
        .eq('id', postId).eq('user_id', userId).maybeSingle();
    if (postError || !post) throw new Error(`Search post lookup failed: ${postError?.message || 'not found'}`);
    let revisionQuery = supabaseClient.from('collection_source_revisions')
        .select('id, post_id, capture_quality, source_payload').eq('user_id', userId).eq('post_id', postId)
        .order('created_at', { ascending: false });
    if (sourceRevisionId) revisionQuery = revisionQuery.eq('id', sourceRevisionId);
    const revisions = await maybeRows(revisionQuery.limit(1));
    const sourceRevision = revisions[0] || null;
    if (!sourceRevision) return { post, sourceRevision: null, learningNote: null, topicLinks: [], topicRevisions: [], projectReferences: [], proposals: [] };
    const revisionId = sourceRevision.id;
    const [learningNotes, topicLinks, topicRevisions, projectReferences, proposals] = await Promise.all([
        maybeRows(supabaseClient.from('owner_post_learning_notes').select('note_status, content').eq('user_id', userId).eq('source_revision_id', revisionId)),
        maybeRows(supabaseClient.from('owner_topic_source_links').select('topic_id, owner_topics (label)').eq('user_id', userId).eq('source_revision_id', revisionId)),
        maybeRows(supabaseClient.from('owner_topic_revisions').select('topic_id, summary, claims, open_questions, owner_topics (label)').eq('user_id', userId).eq('source_revision_id', revisionId)),
        maybeRows(supabaseClient.from('owner_topic_project_references').select('topic_id, rationale, owner_topics (label), owner_project_catalog (title, description, reference)').eq('user_id', userId).eq('source_revision_id', revisionId).eq('status', 'active')),
        maybeRows(supabaseClient.from('owner_review_proposals').select('proposal_type, payload, status').eq('user_id', userId).eq('source_revision_id', revisionId))
    ]);
    return { post, sourceRevision, learningNote: learningNotes[0] || null, topicLinks, topicRevisions, projectReferences, proposals };
}

export async function refreshOwnerPostSearchDocument({ userId, postId, sourceRevisionId = null, supabaseClient = defaultSupabase }) {
    const inputs = await loadOwnerSearchInputs({ userId, postId, sourceRevisionId, supabaseClient });
    const document = buildOwnerSearchDocument(inputs);
    if (!document.post_id || !document.user_id) throw new Error('post_id and user_id are required for search indexing');
    const { data, error } = await supabaseClient.rpc('upsert_owner_post_search_document', {
        p_user_id: document.user_id, p_post_id: document.post_id, p_source_revision_id: document.source_revision_id,
        p_source_quality: document.source_quality, p_title: document.title, p_raw_text: document.raw_text,
        p_formal_text: document.formal_text, p_candidate_text: document.candidate_text,
        p_formal_reasons: document.formal_reasons, p_candidate_reasons: document.candidate_reasons
    });
    if (error) throw new Error(`Owner-guided search document upsert failed: ${error.message}`);
    return data;
}

export async function searchOwnerPostDocuments({ userId, query = null, limit = 30, includeCandidates = false, supabaseClient = defaultSupabase } = {}) {
    if (!userId) throw new Error('userId is required for search');
    const { data, error } = await supabaseClient.rpc('search_owner_post_documents', {
        p_user_id: userId, p_query: text(query, 1_000) || null,
        p_limit: Math.min(Math.max(Number(limit) || 30, 1), 100), p_include_candidates: includeCandidates === true
    });
    if (error) throw new Error(`Owner-guided search failed: ${error.message}`);
    return Array.isArray(data) ? data : [];
}
