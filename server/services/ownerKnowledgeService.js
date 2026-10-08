import { supabase as defaultSupabase } from '../supabaseClient.js';

function requiredText(value, field, maxLength) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        throw new Error(`${field} must be a non-empty string up to ${maxLength} characters`);
    }
    return value.trim();
}

export function normalizeOwnerTopicLabel(value) {
    const label = requiredText(value, 'label', 120);
    return { label, normalizedLabel: label.toLocaleLowerCase('zh-TW') };
}

export function normalizeCatalogSlug(value) {
    const slug = requiredText(value, 'slug', 80).toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(slug)) throw new Error('slug must use lowercase letters, numbers, underscores, or hyphens');
    return slug;
}

export function normalizeProjectCatalogInput(input = {}) {
    const projectKind = String(input.project_kind || '').trim();
    if (!['local_repository', 'remote_repository', 'non_code'].includes(projectKind)) {
        throw new Error('project_kind must be local_repository, remote_repository, or non_code');
    }
    return {
        title: requiredText(input.title, 'title', 160),
        slug: normalizeCatalogSlug(input.slug),
        project_kind: projectKind,
        reference: requiredText(input.reference, 'reference', 2048),
        description: typeof input.description === 'string' ? input.description.trim().slice(0, 4000) || null : null
    };
}

export async function listOwnerTopics({ userId, topicId = null, supabaseClient = defaultSupabase }) {
    let query = supabaseClient
        .from('owner_topics')
        .select(`
            id, label, normalized_label, status, created_at, updated_at,
            owner_topic_source_links (id, source_revision_id, created_at),
            owner_topic_revisions (id, revision_number, summary, claims, open_questions, source_revision_id, created_at),
            owner_topic_project_references (
                id, rationale, status, source_revision_id, created_at,
                owner_project_catalog (id, title, project_kind, reference, status)
            )
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    if (topicId) query = query.eq('id', topicId);
    const { data, error } = await query;
    if (error) throw new Error(`Owner Topic lookup failed: ${error.message}`);
    return data || [];
}

export async function createOwnerTopic({ userId, label, supabaseClient = defaultSupabase }) {
    const normalized = normalizeOwnerTopicLabel(label);
    const { data, error } = await supabaseClient
        .from('owner_topics')
        .insert({ user_id: userId, label: normalized.label, normalized_label: normalized.normalizedLabel })
        .select('id, label, normalized_label, status, created_at, updated_at')
        .single();
    if (error) {
        const wrapped = new Error(`Owner Topic creation failed: ${error.message}`);
        wrapped.code = error.code;
        throw wrapped;
    }
    return data;
}

export async function listProjectCatalog({ userId, supabaseClient = defaultSupabase }) {
    const { data, error } = await supabaseClient
        .from('owner_project_catalog')
        .select('id, title, slug, project_kind, reference, description, status, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    if (error) throw new Error(`Project Catalog lookup failed: ${error.message}`);
    return data || [];
}

export async function listLegacyProjects({ userId, supabaseClient = defaultSupabase }) {
    const { data, error } = await supabaseClient
        .from('collection_projects')
        .select('id, title, slug, repository_target, description, status, created_at, updated_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false });
    if (error) throw new Error(`Legacy Project lookup failed: ${error.message}`);
    return data || [];
}

export async function listLegacyTopics({ userId, supabaseClient = defaultSupabase }) {
    const { data, error } = await supabaseClient
        .from('collection_topics')
        .select('id, title, slug, description, purpose, keywords, desired_outcomes, created_at, updated_at')
        .eq('user_id', userId)
        .eq('origin', 'user')
        .eq('status', 'active')
        .order('updated_at', { ascending: false });
    if (error) throw new Error(`Legacy Topic lookup failed: ${error.message}`);
    return data || [];
}

export async function importLegacyTopicToOwner({ userId, legacyTopicId, supabaseClient = defaultSupabase }) {
    const { data: legacy, error: legacyError } = await supabaseClient
        .from('collection_topics')
        .select('id, title, slug, description, purpose, keywords, desired_outcomes, origin, status')
        .eq('id', legacyTopicId)
        .eq('user_id', userId)
        .eq('origin', 'user')
        .eq('status', 'active')
        .maybeSingle();
    if (legacyError) throw new Error(`Legacy Topic lookup failed: ${legacyError.message}`);
    if (!legacy) {
        const error = new Error('Legacy Topic was not found');
        error.code = 'LEGACY_TOPIC_NOT_FOUND';
        throw error;
    }
    try {
        return await createOwnerTopic({ userId, label: legacy.title, supabaseClient });
    } catch (error) {
        if (error?.code !== '23505') throw error;
        const { normalizedLabel } = normalizeOwnerTopicLabel(legacy.title);
        const { data: existing, error: existingError } = await supabaseClient
            .from('owner_topics')
            .select('id, label, normalized_label, status, created_at, updated_at')
            .eq('user_id', userId)
            .eq('normalized_label', normalizedLabel)
            .maybeSingle();
        if (existingError) throw new Error(`Owner Topic lookup failed: ${existingError.message}`);
        if (existing) return existing;
        throw error;
    }
}

export async function importLegacyProjectToCatalog({ userId, legacyProjectId, supabaseClient = defaultSupabase }) {
    const { data: legacy, error: legacyError } = await supabaseClient
        .from('collection_projects')
        .select('id, title, slug, repository_target, description, status')
        .eq('id', legacyProjectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    if (legacyError) throw new Error(`Legacy Project lookup failed: ${legacyError.message}`);
    if (!legacy) {
        const error = new Error('Legacy Project was not found');
        error.code = 'LEGACY_PROJECT_NOT_FOUND';
        throw error;
    }
    const description = [legacy.description, 'Imported after explicit Owner approval from the previous project list.']
        .filter(Boolean)
        .join('\n\n');
    try {
        return await createProjectCatalogEntry({
            userId,
            input: {
                title: legacy.title,
                slug: legacy.slug,
                project_kind: 'remote_repository',
                reference: legacy.repository_target,
                description
            },
            supabaseClient
        });
    } catch (error) {
        if (error?.code !== '23505') throw error;
        const { data: existing, error: existingError } = await supabaseClient
            .from('owner_project_catalog')
            .select('id, title, slug, project_kind, reference, description, status, created_at, updated_at')
            .eq('user_id', userId)
            .eq('project_kind', 'remote_repository')
            .eq('reference', legacy.repository_target)
            .maybeSingle();
        if (existingError) throw new Error(`Project Catalog lookup failed: ${existingError.message}`);
        if (existing) return existing;
        throw error;
    }
}

export async function createProjectCatalogEntry({ userId, input, supabaseClient = defaultSupabase }) {
    const project = normalizeProjectCatalogInput(input);
    const { data, error } = await supabaseClient
        .from('owner_project_catalog')
        .insert({ user_id: userId, ...project })
        .select('id, title, slug, project_kind, reference, description, status, created_at, updated_at')
        .single();
    if (error) {
        const wrapped = new Error(`Project Catalog creation failed: ${error.message}`);
        wrapped.code = error.code;
        throw wrapped;
    }
    return data;
}

export async function listTopicProjectReferences({ userId, supabaseClient = defaultSupabase }) {
    const { data, error } = await supabaseClient
        .from('owner_topic_project_references')
        .select(`
            id, topic_id, project_id, source_revision_id, rationale, status, created_at, updated_at,
            owner_topics (id, label, status),
            owner_project_catalog (id, title, project_kind, reference, status),
            owner_poc_proposals (id, objective, isolation_spec, status, version, approved_at, rejected_at, created_at, updated_at)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    if (error) throw new Error(`Topic project reference lookup failed: ${error.message}`);
    return data || [];
}

export async function createPocProposal({ userId, projectReferenceId, objective, isolationSpec = {}, supabaseClient = defaultSupabase }) {
    const safeObjective = requiredText(objective, 'objective', 4000);
    if (!isolationSpec || typeof isolationSpec !== 'object' || Array.isArray(isolationSpec)) throw new Error('isolation_spec must be an object');
    const { data: reference, error: referenceError } = await supabaseClient
        .from('owner_topic_project_references')
        .select('id')
        .eq('id', projectReferenceId).eq('user_id', userId).eq('status', 'active').maybeSingle();
    if (referenceError) throw new Error(`Project reference lookup failed: ${referenceError.message}`);
    if (!reference) {
        const error = new Error('Active project reference was not found');
        error.code = 'PROJECT_REFERENCE_NOT_FOUND';
        throw error;
    }
    const { data, error } = await supabaseClient
        .from('owner_poc_proposals')
        .insert({ user_id: userId, project_reference_id: projectReferenceId, objective: safeObjective, isolation_spec: isolationSpec })
        .select('id, project_reference_id, objective, isolation_spec, status, version, approved_at, rejected_at, created_at, updated_at')
        .single();
    if (error) throw new Error(`POC proposal creation failed: ${error.message}`);
    return data;
}

export async function decidePocProposal({ userId, proposalId, action, expectedVersion, supabaseClient = defaultSupabase }) {
    if (!['approve', 'reject'].includes(action)) throw new Error('action must be approve or reject');
    const version = Number(expectedVersion);
    if (!Number.isInteger(version) || version < 1) throw new Error('expectedVersion must be a positive integer');
    const patch = action === 'approve'
        ? { status: 'approved', approved_at: new Date().toISOString(), rejected_at: null, version: version + 1 }
        : { status: 'rejected', rejected_at: new Date().toISOString(), approved_at: null, version: version + 1 };
    const { data, error } = await supabaseClient
        .from('owner_poc_proposals')
        .update(patch)
        .eq('id', proposalId).eq('user_id', userId).eq('status', 'proposed').eq('version', version)
        .select('id, project_reference_id, objective, isolation_spec, status, version, approved_at, rejected_at, created_at, updated_at')
        .maybeSingle();
    if (error) throw new Error(`POC proposal decision failed: ${error.message}`);
    if (!data) {
        const conflict = new Error('POC proposal changed concurrently or is no longer proposed');
        conflict.code = 'POC_PROPOSAL_CONFLICT';
        throw conflict;
    }
    return data;
}
