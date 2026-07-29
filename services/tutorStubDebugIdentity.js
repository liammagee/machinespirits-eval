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

export function printTutorStubAutomaticTechnicalDetails(state, render, { print } = {}) {
  if (!tutorStubAutomaticTechnicalDetailsEnabled(state)) return false;
  print(state, render);
  return true;
}

export function projectTutorStubCurrentDebugSelection(state, { duringTurn = false } = {}) {
  const last = state?.turns?.at(-1) || null;
  const runId = resolveTutorStubStateRunDebugId(state);
  const completedId = last?.turnId || (state?.history?.length ? formatTutorStubOpeningDebugId(runId) : null);
  const activeId = duringTurn ? formatTutorStubStateTurnDebugId(state, (last?.turn || 0) + 1) : null;
  return {
    runId,
    completedId,
    activeId,
    selectedId: activeId || completedId || runId,
    tracePath: state?.trace?.filePath || null,
    lastCompletedTurnId: last ? last.turnId || formatTutorStubStateTurnDebugId(state, last.turn) : null,
  };
}

export function projectTutorStubCurrentDebugLines(
  { runId, selectedId, activeId, tracePath, lastCompletedTurnId, clipboard },
  { colors = {} } = {},
) {
  const lines = [
    `${colors.cyan}debug id >${colors.reset} ${selectedId}`,
    `${colors.dim}  run id: ${runId}${colors.reset}`,
  ];
  if (lastCompletedTurnId) {
    lines.push(`${colors.dim}  last completed turn: ${lastCompletedTurnId}${colors.reset}`);
  }
  if (activeId) lines.push(`${colors.dim}  in-progress turn: ${activeId}${colors.reset}`);
  lines.push(
    `${colors.dim}  trace: ${tracePath || 'disabled for this run; rerun without --no-trace for a local JSONL trace'}${colors.reset}`,
    clipboard.copied
      ? `${colors.green}  copied this diagnostic block to the clipboard${colors.reset}\n`
      : `${colors.dim}  clipboard unavailable; select this block to copy it into Codex${colors.reset}\n`,
  );
  return lines;
}

export function createTutorStubCurrentDebugReporter({ formatClipboardText, copyClipboard, write, colors = {} } = {}) {
  return function reportCurrentDebugId(state, { duringTurn = false } = {}) {
    const selection = projectTutorStubCurrentDebugSelection(state, { duringTurn });
    const { runId, completedId, activeId, selectedId, tracePath } = selection;
    const clipboardText = formatClipboardText({ runId, selectedId, completedId, activeId, tracePath });
    const clipboard = copyClipboard(clipboardText);
    for (const line of projectTutorStubCurrentDebugLines({ ...selection, clipboard }, { colors })) write(line);
    return { runId, completedId, activeId, tracePath, clipboard };
  };
}

export function createTutorStubDebugLinePrinters({ write, colors = {} } = {}) {
  return {
    printTurnDebugLine(state, turn) {
      if (!tutorStubAutomaticTechnicalDetailsEnabled(state)) return null;
      return printTutorStubDebugIdLine(state, formatTutorStubStateTurnDebugId(state, turn), 'turn id', {
        write,
        colors,
      });
    },
    printOpeningDebugLine(state) {
      if (!tutorStubAutomaticTechnicalDetailsEnabled(state)) return null;
      return printTutorStubDebugIdLine(
        state,
        formatTutorStubOpeningDebugId(resolveTutorStubStateRunDebugId(state)),
        'turn id',
        { write, colors },
      );
    },
  };
}

export function printTutorStubDebugIdLine(state, id, label = 'turn id', { write, colors = {} } = {}) {
  if (!id) return null;
  if (!state.printedDebugIds) state.printedDebugIds = new Set();
  if (state.printedDebugIds.has(id)) return id;
  state.printedDebugIds.add(id);
  write(`${colors.cyan}${label} >${colors.reset} ${id}`);
  return id;
}
