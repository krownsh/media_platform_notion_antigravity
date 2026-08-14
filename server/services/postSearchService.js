import { supabase as defaultSupabase } from '../supabaseClient.js';

const MAX_TEXT = 120_000;
const MAX_TERMS = 60;

function text(value, maxLength = 8_000) {
    return String(value ?? '').replace(/\0/g, '').trim().slice(0, maxLength);
}

function uniqueTerms(values, limit = MAX_TERMS) {
    const result = [];
    const seen = new Set();
    for (const value of Array.isArray(values) ? values : []) {
        const normalized = text(value, 180).replace(/\s+/g, ' ');
        if (!normalized) continue;
        const key = normalized.toLocaleLowerCase('zh-TW');
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
        if (result.length >= limit) break;
    }
    return result;
}

function postAnalysis(post) {
    return Array.isArray(post?.collection_post_analysis)
        ? post.collection_post_analysis[0]
        : post?.collection_post_analysis || post?.analysis || {};
}

function postWorkflow(post) {
    const workflows = Array.isArray(post?.collection_post_workflows)
        ? post.collection_post_workflows
        : [];
    return workflows.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))[0]
        || post?.workflow
        || null;
}

function postDrafts(post) {
    return Array.isArray(post?.content_assets)
        ? post.content_assets
        : Array.isArray(post?.drafts) ? post.drafts : [];
}

function annotationText(post) {
    const annotations = Array.isArray(post?.collection_user_annotations)
        ? post.collection_user_annotations
        : Array.isArray(post?.annotations) ? post.annotations : [];
    return annotations.map(annotation => annotation.content).filter(Boolean);
}

function draftText(post) {
    return postDrafts(post).flatMap(asset => {
        const revisions = Array.isArray(asset.content_revisions) ? asset.content_revisions : [];
        const latest = [...revisions].sort((a, b) => Number(b.revision_number || 0) - Number(a.revision_number || 0))[0];
        return [asset.title, latest?.body, asset.metadata?.key_takeaways?.join(' ')];
    }).filter(Boolean);
}

export function buildPostSearchDocument(post, explicit = {}) {
    const analysis = explicit.analysis || postAnalysis(post);
    const workflow = explicit.workflow || postWorkflow(post);
    const generated = explicit.generated || post.search_document || {};
    const title = text(post.title || post.note_title || '', 500);
    const authorName = text(post.author_name || post.author || '', 255);
    const content = text(post.content || '', 30_000);
    const summary = text(analysis.summary || '', 12_000);
    const tags = Array.isArray(analysis.tags) ? analysis.tags : [];
    const topics = Array.isArray(analysis.topics) ? analysis.topics : [];
    const keywords = uniqueTerms([
        ...(generated.keywords || []),
        ...(analysis.keywords || []),
        ...tags,
        ...topics
    ]);
    const entities = uniqueTerms(generated.entities || analysis.entities || []);
    const aliases = uniqueTerms(generated.aliases || analysis.aliases || []);
    const memoryCues = uniqueTerms(generated.memory_cues || generated.memoryCues || []);
    const searchableParts = [
        title,
        authorName,
        text(post.platform, 50),
        text(post.original_url || post.originalUrl || '', 4_000),
        content,
        summary,
        ...tags,
        ...topics,
        ...keywords,
        ...entities,
        ...aliases,
        ...memoryCues,
        ...annotationText(post),
        ...draftText(post),
        text(explicit.contentDraft, 20_000)
    ].filter(Boolean);

    return {
        post_id: post.id || post.dbId,
        user_id: post.user_id,
        title,
        author_name: authorName,
        platform: text(post.platform || 'generic', 50),
        source_url: post.original_url || post.originalUrl || null,
        collection_id: post.collection_id || post.collectionId || null,
        workflow_stage: workflow?.stage || null,
        workflow_status: workflow?.status || null,
        search_text: searchableParts.join('\n').slice(0, MAX_TEXT),
        keywords,
        entities,
        aliases,
        memory_cues: memoryCues
    };
}

export async function upsertPostSearchDocument(post, options = {}) {
    const supabase = options.supabaseClient || defaultSupabase;
    const document = buildPostSearchDocument(post, options);
    if (!document.post_id || !document.user_id) throw new Error('post_id and user_id are required for search indexing');

    const { data, error } = await supabase.rpc('upsert_collection_post_search_document', {
        p_user_id: document.user_id,
        p_post_id: document.post_id,
        p_title: document.title,
        p_author_name: document.author_name,
        p_platform: document.platform,
        p_source_url: document.source_url,
        p_collection_id: document.collection_id,
        p_workflow_stage: document.workflow_stage,
        p_workflow_status: document.workflow_status,
        p_search_text: document.search_text,
        p_keywords: document.keywords,
        p_entities: document.entities,
        p_aliases: document.aliases,
        p_memory_cues: document.memory_cues
    });
    if (error) throw new Error(`Search document upsert failed: ${error.message}`);
    return data;
}

export async function searchPostDocuments({
    userId,
    query = null,
    limit = 30,
    platform = null,
    collectionId = null,
    workflowStage = null,
    workflowStatus = null,
    supabaseClient = defaultSupabase
} = {}) {
    if (!userId) throw new Error('userId is required for search');
    const { data, error } = await supabaseClient.rpc('search_collection_post_documents', {
        p_user_id: userId,
        p_query: query || null,
        p_limit: Math.min(Math.max(Number(limit) || 30, 1), 100),
        p_platform: platform || null,
        p_collection_id: collectionId || null,
        p_workflow_stage: workflowStage || null,
        p_workflow_status: workflowStatus || null
    });
    if (error) throw new Error(`Search failed: ${error.message}`);
    return Array.isArray(data) ? data : [];
}
