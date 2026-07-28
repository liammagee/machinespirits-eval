function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function restoreTutorStubRegisterStateFromTurns(state, turns) {
  if (!state.register?.enabled) return { restored: 0 };
  const byTurn = new Map();
  for (const turn of turns) {
    if (!turn?.registerSelection) continue;
    const selection = jsonClone(turn.registerSelection);
    const key = Number(selection.turn || turn.turn);
    if (!Number.isFinite(key)) continue;
    byTurn.set(key, selection);
  }
  for (const turn of turns) {
    const efficacy = turn?.previousRegisterEfficacy;
    const key = Number(efficacy?.registerTurn);
    if (!Number.isFinite(key) || !byTurn.has(key)) continue;
    const selection = byTurn.get(key);
    if (!selection.efficacy) selection.efficacy = jsonClone(efficacy);
  }
  state.register.history = [...byTurn.values()].sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));
  state.register.current = state.register.history[state.register.history.length - 1] || null;
  return { restored: state.register.history.length };
}
