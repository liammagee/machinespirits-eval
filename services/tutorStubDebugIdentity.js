function normalizedRunId(runId) {
  return String(runId || 'no-trace').trim() || 'no-trace';
}

export function formatTutorStubSafeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function formatTutorStubTurnDebugId(runId, turn) {
  const turnNumber = Number.parseInt(turn, 10);
  const normalized = normalizedRunId(runId);
  if (!Number.isFinite(turnNumber) || turnNumber < 1) return normalized;
  return `${normalized}:t${String(turnNumber).padStart(3, '0')}`;
}

export function formatTutorStubOpeningDebugId(runId) {
  return `${normalizedRunId(runId)}:opening`;
}
