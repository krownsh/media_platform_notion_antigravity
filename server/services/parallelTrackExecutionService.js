import { withParallelTrack } from './parallelTrackService.js';

const TRACK_KEYS = ['knowledge', 'project_application'];

function errorReason(error) {
  const message = String(error?.message || error || 'unknown error').trim();
  return `分支執行失敗：${message.slice(0, 500)}`;
}

function resultForTrack(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('Track task must return a status and reason');
  }
  if (typeof result.status !== 'string' || typeof result.reason !== 'string' || !result.reason.trim()) {
    throw new Error('Track task must return a status and non-empty reason');
  }
  return result;
}

// Executes independent, non-terminal workflow tracks without allowing one task
// failure to suppress the other task's persisted status. Callers must persist the
// returned context through their normal optimistic-lock workflow transition.
export async function executeParallelTracks(context, tasks = {}, now = new Date().toISOString()) {
  let nextContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
  const outcomes = {};

  for (const trackKey of TRACK_KEYS) {
    const task = tasks[trackKey];
    if (typeof task !== 'function') continue;
    try {
      const result = resultForTrack(await task());
      nextContext = withParallelTrack(nextContext, trackKey, result, now);
      outcomes[trackKey] = { ok: true, status: result.status, reason: result.reason, details: result.details ?? null };
    } catch (error) {
      const reason = errorReason(error);
      nextContext = withParallelTrack(nextContext, trackKey, { status: 'failed', reason }, now);
      outcomes[trackKey] = { ok: false, status: 'failed', reason, details: null };
    }
  }

  return { context: nextContext, outcomes };
}
