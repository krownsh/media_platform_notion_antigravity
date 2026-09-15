export const TRACK_STATUSES = new Set([
    'pending',
    'processing',
    'needs_review',
    'completed',
    'not_applicable',
    'failed'
]);

const TRACK_DEFAULTS = {
    knowledge: { status: 'pending', reason: '等待知識整理', updated_at: null },
    project_application: { status: 'not_applicable', reason: '尚未連結專案應用', updated_at: null }
};

const TRACK_KEYS = new Set(Object.keys(TRACK_DEFAULTS));

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTrack(value, defaults) {
    const track = asObject(value);
    if (!TRACK_STATUSES.has(track.status)) return { ...defaults };
    return {
        status: track.status,
        reason: typeof track.reason === 'string' && track.reason.trim() ? track.reason.trim() : defaults.reason,
        updated_at: typeof track.updated_at === 'string' && track.updated_at.trim() ? track.updated_at : null
    };
}

export function normalizeParallelTracks(context) {
    const tracks = asObject(asObject(context).parallel_tracks);
    return {
        knowledge: normalizeTrack(tracks.knowledge, TRACK_DEFAULTS.knowledge),
        project_application: normalizeTrack(tracks.project_application, TRACK_DEFAULTS.project_application)
    };
}

export function withParallelTrack(context, trackKey, patch, now = new Date().toISOString()) {
    if (!TRACK_KEYS.has(trackKey)) throw new Error(`Unsupported parallel track: ${trackKey}`);
    const nextPatch = asObject(patch);
    if (!TRACK_STATUSES.has(nextPatch.status)) {
        throw new Error(`Unsupported parallel track status: ${nextPatch.status || ''}`);
    }
    const current = normalizeParallelTracks(context);
    const defaults = TRACK_DEFAULTS[trackKey];
    const reason = typeof nextPatch.reason === 'string' && nextPatch.reason.trim()
        ? nextPatch.reason.trim()
        : current[trackKey].reason || defaults.reason;
    return {
        ...asObject(context),
        parallel_tracks: {
            ...current,
            [trackKey]: { status: nextPatch.status, reason, updated_at: now }
        }
    };
}
