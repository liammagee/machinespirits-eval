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

export function resolveTutorStubStateRunDebugId(state) {
  return state?.debugRunId || state?.trace?.runId || 'no-trace';
}

export function formatTutorStubStateTurnDebugId(state, turn) {
  return formatTutorStubTurnDebugId(resolveTutorStubStateRunDebugId(state), turn);
}

export function tutorStubAutomaticTechnicalDetailsEnabled(state) {
  return Boolean(state?.explanatoryDebug?.enabled && state.explanatoryDebug.format === 'technical');
}

export function printTutorStubDebugIdLine(state, id, label = 'turn id', { write, colors = {} } = {}) {
  if (!id) return null;
  if (!state.printedDebugIds) state.printedDebugIds = new Set();
  if (state.printedDebugIds.has(id)) return id;
  state.printedDebugIds.add(id);
  write(`${colors.cyan}${label} >${colors.reset} ${id}`);
  return id;
}
