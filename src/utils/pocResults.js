export function getLatestSuccessfulPocResult(insights) {
  if (!Array.isArray(insights)) return null;

  for (let index = insights.length - 1; index >= 0; index -= 1) {
    const insight = insights[index];
    if (insight?.type === 'poc_run' && insight.status === 'success') {
      return insight;
    }
  }

  return null;
}

export function formatPocDuration(durationMs) {
  if (durationMs == null || durationMs === '') return '未提供';
  const milliseconds = Number(durationMs);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '未提供';
  return `${(milliseconds / 1000).toFixed(milliseconds >= 10_000 ? 1 : 2)} 秒`;
}
