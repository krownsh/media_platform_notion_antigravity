import { loadOwnerSearchInputs } from './ownerSearchService.js';
import {
    appendLocalNoteEvent,
    createPostCaseFileManifest,
    loadPostCaseFileManifest,
    recordLocalNoteCaptureRevisionDelivery,
    recordLocalNoteDelivery
} from './localMediaKnowledgeService.js';
import {
    appendPostCaseFileEvent,
    appendPostCaseFileCaptureRevision,
    rehomePostCaseFileToInbox,
    writeInitialPostCaseFile
} from './localMediaKnowledgeVaultService.js';

export const DEFAULT_MEDIA_KNOWLEDGE_VAULT_ROOT = '/Volumes/DevSSD/10_Projects/Personal/media_collection';

export async function createOrRetryLocalPostCaseFile({
    userId,
    postId,
    vaultRoot = process.env.MEDIA_KNOWLEDGE_VAULT_PATH || DEFAULT_MEDIA_KNOWLEDGE_VAULT_ROOT,
    loadInputs = loadOwnerSearchInputs,
    createManifest = createPostCaseFileManifest,
    loadCaptureEvent = async () => null,
    appendEvent = appendLocalNoteEvent,
    loadManifest = loadPostCaseFileManifest,
    writeFile = writeInitialPostCaseFile,
    appendCaptureRevision = appendPostCaseFileCaptureRevision,
    recordCaptureRevisionDelivery = recordLocalNoteCaptureRevisionDelivery,
    recordDelivery = recordLocalNoteDelivery
}) {
    const inputs = await loadInputs({ userId, postId });
    if (!inputs?.sourceRevision?.id) throw new Error('LOCAL_NOTE_SOURCE_REVISION_REQUIRED');
    const manifest = await createManifest({ userId, postId, sourceRevisionId: inputs.sourceRevision.id });
    const isNewerSourceRevision = manifest.source_revision_id !== inputs.sourceRevision.id;
    if (manifest.sync_state === 'synchronized' && !isNewerSourceRevision) return { manifest, outcome: 'already_synchronized' };
    if (manifest.sync_state === 'synchronized' && isNewerSourceRevision) {
        if (!manifest.relative_path) throw new Error('LOCAL_NOTE_RELATIVE_PATH_REQUIRED');
        const event = await appendEvent({
            userId, manifestId: manifest.id, eventType: 'capture', eventStatus: 'recorded', actorKind: 'system',
            sourceRevisionId: inputs.sourceRevision.id,
            eventPayload: {
                schema_version: 1,
                source_revision_id: inputs.sourceRevision.id,
                outcome: 'A repaired source revision was appended to the existing case file without replacing earlier evidence.'
            }
        });
        const file = await appendCaptureRevision({
            vaultRoot,
            relativePath: manifest.relative_path,
            post: inputs.post,
            sourceRevisionId: inputs.sourceRevision.id,
            sourcePayload: inputs.sourceRevision.source_payload || null,
            captureQuality: inputs.sourceRevision.capture_quality || 'partial',
            occurredAt: event.occurred_at || null
        });
        const currentManifest = await loadManifest({ userId, postId });
        if (!currentManifest) throw new Error('LOCAL_NOTE_MANIFEST_NOT_FOUND');
        const delivered = await recordCaptureRevisionDelivery({
            userId,
            manifestId: currentManifest.id,
            expectedVersion: currentManifest.version,
            sourceRevisionId: inputs.sourceRevision.id,
            relativePath: file.relativePath,
            checksum: file.checksum,
            lastWrittenEventSequence: event.sequence
        });
        return { manifest: delivered, outcome: 'source_revision_appended' };
    }
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
        captureQuality: inputs.sourceRevision.capture_quality || 'partial'
    });
    const delivered = await recordDelivery({
        userId, manifestId: currentManifest.id, expectedVersion: currentManifest.version,
        relativePath: file.relativePath, checksum: file.checksum, lastWrittenEventSequence: event.sequence
    });
    return { manifest: delivered, outcome: 'synchronized' };
}

export async function rehomeLocalPostCaseFileToInbox({
    userId,
    postId,
    vaultRoot = process.env.MEDIA_KNOWLEDGE_VAULT_PATH || DEFAULT_MEDIA_KNOWLEDGE_VAULT_ROOT,
    loadInputs = loadOwnerSearchInputs,
    loadManifest = loadPostCaseFileManifest,
    moveFile = rehomePostCaseFileToInbox,
    appendEvent = appendLocalNoteEvent,
    appendFileEvent = appendPostCaseFileEvent,
    recordDelivery = recordLocalNoteDelivery
}) {
    const [inputs, manifest] = await Promise.all([
        loadInputs({ userId, postId }),
        loadManifest({ userId, postId })
    ]);
    if (!inputs?.sourceRevision?.id) throw new Error('LOCAL_NOTE_SOURCE_REVISION_REQUIRED');
    if (!manifest?.relative_path) throw new Error('LOCAL_NOTE_RELATIVE_PATH_REQUIRED');
    const file = await moveFile({
        vaultRoot,
        relativePath: manifest.relative_path,
        post: inputs.post,
        sourcePayload: inputs.sourceRevision.source_payload || null
    });
    if (!file.moved && !file.recovered && manifest.relative_path === file.relativePath) {
        return { manifest, outcome: 'already_in_inbox' };
    }
    const event = await appendEvent({
        userId,
        manifestId: manifest.id,
        eventType: 'rename_move',
        eventStatus: 'recorded',
        actorKind: 'system',
        sourceRevisionId: inputs.sourceRevision.id,
        eventPayload: {
            schema_version: 1,
            outcome: 'Reconciled this single existing case file into the user-directed Inbox baseline.',
            from_relative_path: manifest.relative_path,
            to_relative_path: file.relativePath,
            semantic_state_changed: false
        }
    });
    const rendered = await appendFileEvent({
        vaultRoot,
        relativePath: file.relativePath,
        event: {
            eventId: event.id,
            occurredAt: event.occurred_at,
            type: 'rename_move',
            status: 'recorded',
            actor: 'system',
            conclusion: '依 Owner 指示，將同一份 case file 移入 Inbox 以完成來源紀錄基線核對；沒有建立副本，也沒有改變任何既有的語義接受決策。'
        }
    });
    const currentManifest = await loadManifest({ userId, postId });
    if (!currentManifest) throw new Error('LOCAL_NOTE_MANIFEST_NOT_FOUND');
    const delivered = await recordDelivery({
        userId,
        manifestId: currentManifest.id,
        expectedVersion: currentManifest.version,
        relativePath: rendered.relativePath,
        checksum: rendered.checksum,
        lastWrittenEventSequence: event.sequence
    });
    return { manifest: delivered, outcome: file.recovered ? 'recovered_and_synchronized' : 'rehomed_and_synchronized' };
}
