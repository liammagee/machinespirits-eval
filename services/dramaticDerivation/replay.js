/**
 * Episode replay — the fast-iteration lever (notes/poetics/2026-06-10-
 * unreliable-learner-design.md, Build A): snapshot a recorded drama at turn
 * t, change one run-level condition, and play a handful of live turns
 * instead of waiting out the whole 25-minute performance.
 *
 * No engine snapshot/restore machinery exists, and none is needed: runDrama
 * is DETERMINISTIC given role outputs, and the engine persists every
 * formally consequential role output in transcript meta (director:
 * release/phase; tutor: move/release/deliberation; learner: adopt/retract/
 * derive/hypothesis/asserts). So a "snapshot at turn t" is just the recorded
 * transcript replayed through the same code path — the engine reconstructs
 * its own state, and the live roles take over at `fromTurn` with that state
 * already in place.
 *
 * The prefix-integrity check (`comparePrefix`) makes the reconstruction
 * verifiable rather than trusted: after the run, the replayed turns'
 * trajectory, release ledger, and event stream are compared field-for-field
 * against the recording. Divergence is loud — and legitimately expected in
 * exactly one case: a condition change that reaches back into the prefix
 * (e.g. a decay schedule with startTurn < fromTurn). The caller decides what
 * divergence means; this module only measures it.
 */

/**
 * Rebuild the role return values the engine saw, from a recorded transcript
 * line. Extra keys in stored meta (e.g. phase.turn) are harmless — the
 * engine reads only the fields it knows.
 */
const RECONSTRUCT = {
  director: (line) => ({
    direction: line.text,
    release: line.meta?.release ?? null,
    phase: line.meta?.phase ?? null,
    act: line.meta?.act ?? null, // stage v2 act verdict (null on pre-v2 recordings)
  }),
  tutor: (line) => ({
    dialogue: line.text,
    move: line.meta?.move ?? null,
    release: line.meta?.release ?? null,
    deliberation: line.meta?.deliberation ?? null,
    releaseDecision: line.meta?.releaseDecision ?? null,
    releaseReason: line.meta?.releaseReason ?? null,
    theory: line.meta?.theory ?? null, // stage v2 reconstruction (null keeps the engine's gate closed)
    plot: line.meta?.plot ?? null,
    plotAudit: line.meta?.plotAudit ?? null,
    throughline: line.meta?.throughline ?? null,
    proofDebt: line.meta?.proofDebt ?? null,
  }),
  learner: (line) => ({
    dialogue: line.text,
    adopt: line.meta?.adopt ?? [],
    retract: line.meta?.retract ?? [],
    derive: line.meta?.derive ?? [],
    hypothesis: line.meta?.hypothesis ?? null,
    asserts: line.meta?.asserts ?? null,
  }),
};

/**
 * Wrap live roles so that turns < fromTurn replay the recorded outputs and
 * turns >= fromTurn run live. `recorded` is a result.json object (the raw
 * runDrama return value); `live` is a {director, tutor, learner} role map
 * built exactly as a fresh run would build it.
 *
 * fromTurn = 1 degenerates to a fully live run; fromTurn = turnsPlayed + 1
 * replays the whole recording and continues past it (useful for extending a
 * maxTurns-bounded episode — a terminally ended recording will simply end
 * the same way again during the prefix, by construction).
 */
export function makeReplayRoles({ recorded, fromTurn, live }) {
  if (!recorded || !Array.isArray(recorded.transcript)) {
    throw new Error('makeReplayRoles: `recorded` must be a runDrama result with a transcript array');
  }
  if (!Number.isInteger(fromTurn) || fromTurn < 1) {
    throw new Error(`makeReplayRoles: fromTurn must be an integer >= 1 (got ${JSON.stringify(fromTurn)})`);
  }
  const turnsPlayed = recorded.turnsPlayed ?? Math.max(0, ...recorded.transcript.map((l) => l.turn));
  if (fromTurn > turnsPlayed + 1) {
    throw new Error(
      `makeReplayRoles: fromTurn ${fromTurn} is beyond the recording (turnsPlayed ${turnsPlayed} — max usable fromTurn is ${turnsPlayed + 1})`,
    );
  }
  for (const roleName of ['director', 'tutor', 'learner']) {
    if (typeof live?.[roleName] !== 'function') {
      throw new Error(`makeReplayRoles: live.${roleName} must be a role function`);
    }
  }

  const lines = new Map();
  for (const line of recorded.transcript) {
    lines.set(`${line.role}:${line.turn}`, line);
  }

  const wrap = (roleName) => async (view) => {
    if (view.turn >= fromTurn) return live[roleName](view);
    const line = lines.get(`${roleName}:${view.turn}`);
    if (!line) {
      // Only reachable if the recording's final turn ended mid-turn (a leak
      // break skips the learner) AND the engine re-runs past that point —
      // which the engine's own re-detection of the ending should prevent.
      throw new Error(`replay hole: no recorded ${roleName} line for turn ${view.turn} (prefix < ${fromTurn})`);
    }
    return RECONSTRUCT[roleName](line);
  };

  const director = wrap('director');
  director.prologue = async () => {
    if (recorded.stagePrologue) return recorded.stagePrologue;
    const line = recorded.transcript.find((entry) => entry.role === 'director' && entry.meta?.prologue);
    return line?.meta?.prologue || null;
  };

  return { director, tutor: wrap('tutor'), learner: wrap('learner') };
}

/**
 * Field-for-field formal-channel comparison of the replayed prefix (turns <
 * fromTurn) against the recording: trajectory rows (turn/D/forced/
 * groundedCount), release ledger entries (turn/premiseId/via), and event
 * (turn, type) pairs. Returns { ok, prefixTurns, mismatches } with
 * mismatches capped at 20 — one is already disqualifying, the cap just keeps
 * the report readable.
 */
export function comparePrefix(result, recorded, fromTurn) {
  const mismatches = [];
  const push = (kind, turn, expected, actual) => {
    if (mismatches.length < 20) mismatches.push({ kind, turn, expected, actual });
  };
  const upTo = (rows) => (rows || []).filter((row) => row.turn < fromTurn);

  const trajA = upTo(recorded.trajectory);
  const trajB = upTo(result.trajectory);
  const trajLen = Math.max(trajA.length, trajB.length);
  for (let i = 0; i < trajLen; i += 1) {
    const a = trajA[i];
    const b = trajB[i];
    if (!a || !b) {
      push('trajectory', (a || b).turn, a ? `D=${a.D}` : '(missing)', b ? `D=${b.D}` : '(missing)');
      continue;
    }
    for (const field of ['turn', 'D', 'forced', 'groundedCount']) {
      if (a[field] !== b[field]) push(`trajectory.${field}`, a.turn, a[field], b[field]);
    }
  }

  const ledgerA = upTo(recorded.ledger);
  const ledgerB = upTo(result.ledger);
  const ledgerLen = Math.max(ledgerA.length, ledgerB.length);
  for (let i = 0; i < ledgerLen; i += 1) {
    const a = ledgerA[i] ? JSON.stringify(ledgerA[i]) : '(missing)';
    const b = ledgerB[i] ? JSON.stringify(ledgerB[i]) : '(missing)';
    if (a !== b) push('ledger', (ledgerA[i] || ledgerB[i]).turn, a, b);
  }

  const eventsA = upTo(recorded.events).map((e) => `${e.turn}:${e.type}`);
  const eventsB = upTo(result.events).map((e) => `${e.turn}:${e.type}`);
  const eventsLen = Math.max(eventsA.length, eventsB.length);
  for (let i = 0; i < eventsLen; i += 1) {
    if (eventsA[i] !== eventsB[i]) {
      push('events', null, eventsA[i] ?? '(missing)', eventsB[i] ?? '(missing)');
    }
  }

  return { ok: mismatches.length === 0, prefixTurns: fromTurn - 1, mismatches };
}
