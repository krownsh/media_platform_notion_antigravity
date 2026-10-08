import { randomUUID } from 'node:crypto';
import { supabase as defaultSupabase } from '../supabaseClient.js';
import { promoteReviewProposal } from './reviewPromotionService.js';
import { refreshOwnerPostSearchDocument } from './ownerSearchService.js';

const AUTO_COLLECTION_MARKER = 'Hermes 自動建立';

function failure(message, code = 'OWNER_LIBRARY_ORGANIZATION_INVALID') {
    const error = new Error(message);
    error.code = code;
    return error;
}

function folderName(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
        throw failure('folder_name must be a non-empty string up to 120 characters');
    }
    return value.trim();
}

function folderId(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 128) {
        throw failure('collection_id must be a folder id or null');
    }
    return value.trim();
}

function isLegacyAutomaticCollection(collection) {
    return String(collection?.description || '').includes(AUTO_COLLECTION_MARKER);
}

async function recordManualOrganizationActivity({ userId, postId = null, summary, metadata, supabaseClient }) {
    const { error } = await supabaseClient
        .from('collection_activity_events')
        .insert({
            event_key: `owner-library:${randomUUID()}`,
            user_id: userId,
            post_id: postId,
            event_type: 'workflow_action',
            event_result: 'succeeded',
            summary,
            metadata: { schema_version: 1, actor: 'owner', ...metadata }
        });
    if (error) throw failure(`Manual organization audit failed: ${error.message}`, 'OWNER_LIBRARY_AUDIT_FAILED');
}

async function findOpenFolderCandidate({ userId, postId, supabaseClient }) {
    const { data, error } = await supabaseClient
        .from('owner_review_packets')
        .select('id, version, source_revision_id, owner_review_proposals (id, proposal_type, status, payload)')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .eq('status', 'open')
        .order('updated_at', { ascending: false });
    if (error) throw failure(`Review packet lookup failed: ${error.message}`, 'OWNER_LIBRARY_REVIEW_LOOKUP_FAILED');

    for (const packet of data || []) {
        const proposal = (packet.owner_review_proposals || []).find(item => item?.proposal_type === 'folder_assignment'
            && ['pending', 'proposed'].includes(item.status));
        if (proposal) return { packet, proposal };
    }
    return null;
}

async function refreshSearchProjection({ userId, postId, sourceRevisionId, supabaseClient, searchIndexer }) {
    try {
        await searchIndexer({ userId, postId, sourceRevisionId, supabaseClient });
    } catch (error) {
        // Search is a projection. The Owner decision has already been durably
        // recorded and must remain visible if a rebuild is temporarily delayed.
        console.warn(`[Owner library] Search projection deferred: ${error.message}`);
    }
}

export async function createOwnerLibraryFolder({ userId, name, supabaseClient = defaultSupabase }) {
    if (!userId) throw failure('userId is required');
    const normalizedName = folderName(name);
    const { data: collection, error } = await supabaseClient
        .from('collection_collections')
        .insert({ user_id: userId, name: normalizedName })
        .select('id, user_id, name, description, created_at, updated_at')
        .single();
    if (error || !collection) throw failure(`Folder creation failed: ${error?.message || 'no collection returned'}`, error?.code);

    try {
        await recordManualOrganizationActivity({
            userId,
            summary: `Owner 建立資料夾：${collection.name}`,
            metadata: { action: 'manual_folder_create', collection_id: collection.id, collection_name: collection.name },
            supabaseClient
        });
    } catch (auditError) {
        // Do not expose an unaudited creation as a success. This is a narrow,
        // best-effort compensation for the existing non-transactional schema.
        await supabaseClient.from('collection_collections').delete().eq('id', collection.id).eq('user_id', userId);
        throw auditError;
    }
    return collection;
}

export async function setOwnerLibraryFolder({
    userId,
    postId,
    collectionId,
    supabaseClient = defaultSupabase,
    promote = promoteReviewProposal,
    searchIndexer = refreshOwnerPostSearchDocument
}) {
    if (!userId || typeof postId !== 'string' || !postId.trim()) throw failure('userId and postId are required');
    const targetCollectionId = folderId(collectionId);
    const { data: post, error: postError } = await supabaseClient
        .from('collection_posts')
        .select('id, collection_id')
        .eq('id', postId)
        .eq('user_id', userId)
        .maybeSingle();
    if (postError || !post) throw failure(`Source not found: ${postError?.message || 'not found'}`, 'OWNER_LIBRARY_POST_NOT_FOUND');

    let collection = null;
    if (targetCollectionId) {
        const { data, error } = await supabaseClient
            .from('collection_collections')
            .select('id, name, description')
            .eq('id', targetCollectionId)
            .eq('user_id', userId)
            .maybeSingle();
        if (error || !data) throw failure(`Folder not found: ${error?.message || 'not found'}`, 'OWNER_LIBRARY_FOLDER_NOT_FOUND');
        if (isLegacyAutomaticCollection(data)) {
            throw failure('Automatic legacy folders cannot be selected as an Owner folder', 'OWNER_LIBRARY_FOLDER_NOT_SELECTABLE');
        }
        collection = data;
    }

    const candidate = await findOpenFolderCandidate({ userId, postId, supabaseClient });
    if (candidate) {
        const packet = await promote({
            userId,
            packetId: candidate.packet.id,
            proposalId: candidate.proposal.id,
            action: 'edit_and_accept',
            expectedVersion: candidate.packet.version,
            editedPayload: {
                ...(candidate.proposal.payload || {}),
                folder_id: targetCollectionId,
                suggested_name: collection?.name || null,
                rationale: 'Owner selected this folder directly from the Library.'
            },
            supabaseClient,
            searchIndexer
        });
        return { collection_id: targetCollectionId, collection, decision_path: 'review_promotion', packet };
    }

    const { error: updateError } = await supabaseClient
        .from('collection_posts')
        .update({ collection_id: targetCollectionId })
        .eq('id', postId)
        .eq('user_id', userId);
    if (updateError) throw failure(`Folder assignment failed: ${updateError.message}`, 'OWNER_LIBRARY_ASSIGNMENT_FAILED');

    try {
        await recordManualOrganizationActivity({
            userId,
            postId,
            summary: `Owner 將來源移至：${collection?.name || 'Inbox'}`,
            metadata: {
                action: 'manual_folder_override',
                previous_collection_id: post.collection_id || null,
                collection_id: targetCollectionId,
                collection_name: collection?.name || null
            },
            supabaseClient
        });
    } catch (auditError) {
        await supabaseClient.from('collection_posts').update({ collection_id: post.collection_id || null })
            .eq('id', postId).eq('user_id', userId);
        throw auditError;
    }

    await refreshSearchProjection({ userId, postId, supabaseClient, searchIndexer });
    return { collection_id: targetCollectionId, collection, decision_path: 'manual_override', packet: null };
}
