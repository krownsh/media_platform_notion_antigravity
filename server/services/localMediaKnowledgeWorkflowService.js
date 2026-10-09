import { loadOwnerSearchInputs } from './ownerSearchService.js';
import {
    appendLocalNoteEvent,
    createPostCaseFileManifest,
    loadPostCaseFileManifest,
    recordLocalNoteDelivery
} from './localMediaKnowledgeService.js';
import { writeInitialPostCaseFile } from './localMediaKnowledgeVaultService.js';

export const DEFAULT_MEDIA_KNOWLEDGE_VAULT_ROOT = '/Volumes/DevSSD/10_Projects/Personal/media_collection';

export async function createOrRetryLocalPostCaseFile({
    userId,
    postId,
    sourceRevisionId = null,
    vaultRoot = process.env.MEDIA_KNOWLEDGE_VAULT_PATH || DEFAULT_MEDIA_KNOWLEDGE_VAULT_ROOT,
    loadInputs = loadOwnerSearchInputs,
    createManifest = createPostCaseFileManifest,
    loadCaptureEvent = async () => null,
    appendEvent = appendLocalNoteEvent,
    loadManifest = loadPostCaseFileManifest,
    writeFile = writeInitialPostCaseFile,
    recordDelivery = recordLocalNoteDelivery,
    historicalImport = null
}) {
    const inputs = await loadInputs({ userId, postId, sourceRevisionId });
    if (!inputs?.sourceRevision?.id) throw new Error('LOCAL_NOTE_SOURCE_REVISION_REQUIRED');
    const manifest = await createManifest({ userId, postId, sourceRevisionId: inputs.sourceRevision.id });
    if (manifest.sync_state === 'synchronized') return { manifest, outcome: 'already_synchronized' };
    const existingEvent = await loadCaptureEvent({ userId, manifestId: manifest.id });
    const event = existingEvent || await appendEvent({
        userId, manifestId: manifest.id, eventType: 'capture', eventStatus: 'recorded', actorKind: 'system',
        sourceRevisionId: inputs.sourceRevision.id,
        eventPayload: { schema_version: 1, source_revision_id: inputs.sourceRevision.id, outcome: 'Initial case-file delivery requested.' }
    });
    const currentManifest = await loadManifest({ userId, postId });
    if (!currentManifest) throw new Error('LOCAL_NOTE_MANIFEST_NOT_FOUND');
    const file = await writeFile({
        vaultRoot, post: inputs.post, sourceRevisionId: inputs.sourceRevision.id,
        sourcePayload: inputs.sourceRevision.source_payload || null,
        historicalImport
    });
    const delivered = await recordDelivery({
        userId, manifestId: currentManifest.id, expectedVersion: currentManifest.version,
        relativePath: file.relativePath, checksum: file.checksum, lastWrittenEventSequence: event.sequence
    });
    return { manifest: delivered, outcome: 'synchronized' };
}
