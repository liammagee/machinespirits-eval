// Board tutor policies for the tutor stub (Step 2 of
// notes/2026-09-04-scoreboard-replay-prompt.md).
//
// Two register policies share one code path:
//   board       the tutor reads the public scoreboard before each turn;
//   board_blind the same tutor with the board block removed from its prompt.
// Both arms build the live board from the dialogue's own trace file plus the
// record of the current turn as it stands before the tutor call, and both
// record the board row in the trace. Only the board arm projects the block
// into the tutor prompt.
//
// The licence check reads the completed tutor row. A tutor move that needs a
// right the licence does not hold is a defect: in the board arm it stops the
// dialogue; in the blind arm it is recorded only.

import { buildScoreboard, readTutorStubTraceEvents } from './tutorStubScoreboard.js';

export const TUTOR_STUB_SCOREBOARD_BOARD_POLICY = 'board';
export const TUTOR_STUB_SCOREBOARD_BLIND_POLICY = 'board_blind';
export const TUTOR_STUB_SCOREBOARD_POLICIES = Object.freeze([
  TUTOR_STUB_SCOREBOARD_BOARD_POLICY,
  TUTOR_STUB_SCOREBOARD_BLIND_POLICY,
]);

const NONE = 'none';
const UNREAD = 'unread';
const SPAN_MAX = 160;

export function tutorStubScoreboardPolicyActive(policy) {
  return TUTOR_STUB_SCOREBOARD_POLICIES.includes(String(policy || ''));
}

export function tutorStubScoreboardPolicyReadsBoard(policy) {
  return String(policy || '') === TUTOR_STUB_SCOREBOARD_BOARD_POLICY;
}

export class TutorStubScoreboardLicenceViolation extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'TutorStubScoreboardLicenceViolation';
    this.code = 'TUTOR_STUB_SCOREBOARD_LICENCE_VIOLATION';
    this.details = details;
  }
}

function clip(text) {
  const s = String(text || '')
    .replace(/\s+/gu, ' ')
    .trim();
  return s.length > SPAN_MAX ? `${s.slice(0, SPAN_MAX - 1)}…` : s;
}

function readEvents(tracePath) {
  if (!tracePath) return [];
  try {
    return readTutorStubTraceEvents(tracePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Build the board as it stands at one moment of a live dialogue.
 *
 * `pendingRecord` is the current turn before the tutor has spoken: learner
 * text plus the instrument records the stub already holds (classification,
 * DAG update, proof debt, release pacing, warrant gate). It is appended as a
 * synthetic `turn_complete` event so the reader marks the learner row and
 * derives the tutor's licence for this turn.
 */
export function buildTutorStubLiveScoreboard({
  tracePath = null,
  events = null,
  world = null,
  arm = null,
  pendingRecord = null,
} = {}) {
  const base = Array.isArray(events) ? [...events] : readEvents(tracePath);
  if (pendingRecord) {
    const turn = Number(pendingRecord.turn);
    // A completed record for the same turn (a retry) is replaced by the pending one.
    const filtered = base.filter(
      (e) => !(e?.type === 'turn_complete' && Number(e.turnRecord?.turn ?? e.turn) === turn),
    );
    filtered.push({ type: 'turn_complete', turn, turnRecord: pendingRecord });
    return buildScoreboard({ events: filtered, world, arm });
  }
  return buildScoreboard({ events: base, world, arm });
}

export function tutorStubScoreboardRowsAt(board, turn) {
  const rows = (board?.rows || []).filter((r) => Number(r.turn) === Number(turn));
  return {
    learner: rows.find((r) => r.speaker === 'learner') || null,
    tutor: rows.find((r) => r.speaker === 'tutor') || null,
  };
}

function markLine(mark) {
  const node = mark.node && mark.node !== 'other' ? ` on ${mark.node}` : '';
  const ent = mark.entitlement ? ` (entitlement: ${mark.entitlement})` : '';
  const span = mark.span ? ` "${clip(mark.span)}"` : '';
  return `${mark.value}${node}${ent}${span}`;
}

function fieldSummary(row, field) {
  const value = row?.fields?.[field];
  if (value === undefined || value === null) return UNREAD;
  if (Array.isArray(value)) return value.length ? value.map((x) => x.premiseId || String(x)).join(', ') : NONE;
  return String(value);
}

function rightsText(rights) {
  const list = Array.isArray(rights) ? rights : [];
  if (!list.length) return 'none this turn';
  return list.join('; ');
}

function rightsGloss(rights) {
  const list = new Set(Array.isArray(rights) ? rights : []);
  const lines = [];
  lines.push(
    list.has('challenge')
      ? '- You may challenge the learner this turn: the warrant gate found a claim that needs support.'
      : '- You may not open a new challenge this turn. Answer, name a condition, or offer a test instead.',
  );
  const releases = [...list].filter((r) => r.startsWith('release:')).map((r) => r.slice('release:'.length));
  lines.push(
    releases.length
      ? `- You may release these premises this turn: ${releases.join(', ')}.`
      : '- No premise is due for release this turn. If the learner asks for more, say what you can and cannot give.',
  );
  lines.push(
    list.has('close')
      ? '- The inquiry is complete. You may close it and name the answer.'
      : '- The inquiry is not complete. Do not name the answer.',
  );
  return lines;
}

function historyLines(board, turn) {
  const lines = [];
  for (const row of board?.rows || []) {
    if (Number(row.turn) >= Number(turn)) continue;
    const parts = [];
    for (const m of row.marks || []) {
      if (m.field === 'licence_in_force' || m.field === 'scope_statement') continue;
      parts.push(`${m.field}=${m.value}${m.node && m.node !== 'other' ? `@${m.node}` : ''}`);
    }
    if (!parts.length) continue;
    lines.push(`- turn ${row.turn} ${row.speaker}: ${parts.join(', ')}`);
  }
  return lines;
}

function openLedger(board, turn) {
  const { learner, tutor } = tutorStubScoreboardRowsAt(board, turn);
  const row = tutor || learner;
  const debt = row?.fields?.debt;
  const release = row?.fields?.release;
  const lines = [];
  lines.push(`- standing dispute: ${row?.fields?.standing_dispute ?? UNREAD}`);
  const openDemands = [];
  for (const r of board?.rows || []) {
    if (r.speaker !== 'learner' || Number(r.turn) > Number(turn)) continue;
    for (const m of r.marks || []) {
      if (m.field === 'challenge' && m.value === 'issued') openDemands.push({ turn: r.turn, span: m.span });
    }
  }
  const answered = new Set();
  for (const r of board?.rows || []) {
    if (r.speaker !== 'tutor' || Number(r.turn) > Number(turn)) continue;
    for (const m of r.marks || []) {
      if (m.field === 'challenge' && m.value === 'answered' && m.source === 'release') answered.add(Number(r.turn));
    }
  }
  const standing = openDemands.filter((d) => ![...answered].some((t) => t >= Number(d.turn)));
  lines.push(
    standing.length
      ? `- learner demands not yet discharged: ${standing.map((d) => `turn ${d.turn} "${clip(d.span)}"`).join('; ')}`
      : '- learner demands not yet discharged: none',
  );
  lines.push(
    Array.isArray(debt) && debt.length
      ? `- proof debt: ${debt.map((d) => `${d.premiseId} "${clip(d.surface)}" since turn ${d.sinceTurn}`).join('; ')}`
      : `- proof debt: ${debt === UNREAD || debt === undefined ? UNREAD : NONE}`,
  );
  lines.push(
    Array.isArray(release) && release.length
      ? `- released so far: ${release.map((r) => r.premiseId).join(', ')}`
      : `- released so far: ${release === UNREAD || release === undefined ? UNREAD : NONE}`,
  );
  return lines;
}

/**
 * The board block for the tutor prompt. Returns null when the board has no
 * row for this turn (the reader could not place the learner's line).
 */
export function projectTutorStubScoreboardContext(board, { turn } = {}) {
  const { learner, tutor } = tutorStubScoreboardRowsAt(board, turn);
  if (!learner) return null;
  const rights = tutor?.provenance?.tutorRights || [];
  const lines = [];
  lines.push('[Tutor-only public scoreboard]');
  lines.push(
    `Turn ${turn}. One row per party per turn: what each has claimed, earned, challenged, named, offered and been granted, keyed to proof-DAG node ids. Silence changes nothing: a demand, debt or dispute stays open until a test discharges it or the speaker withdraws it in words.`,
  );
  lines.push('Learner this turn:');
  const shown = new Set();
  for (const m of learner.marks || []) {
    if (m.field === 'request' || m.field === 'rival_content') continue;
    shown.add(m.field);
    lines.push(`- ${m.field.replace(/_/gu, ' ')}: ${markLine(m)}`);
  }
  for (const f of ['commitment_undertaken', 'challenge', 'condition_named', 'test', 'forced_entry']) {
    if (!shown.has(f)) lines.push(`- ${f.replace(/_/gu, ' ')}: ${fieldSummary(learner, f)}`);
  }
  const requests = (learner.marks || []).filter((m) => m.field === 'request');
  if (requests.length) lines.push(`- request to you: ${markLine(requests[0])}`);
  const rival = (learner.marks || []).filter((m) => m.field === 'rival_content');
  if (rival.length) lines.push(`- content outside the case: ${markLine(rival[0])}`);
  lines.push('Open on the board:');
  lines.push(...openLedger(board, turn));
  const history = historyLines(board, turn);
  if (history.length) {
    lines.push('Earlier rows (field=value@node):');
    lines.push(...history.slice(-12));
  }
  lines.push(`Your licence this turn: ${rightsText(rights)}`);
  lines.push(...rightsGloss(rights));
  lines.push('Read the board before you choose your move.');
  lines.push(
    '- If a learner demand stands, answer it first: release what is due, or say in words what you cannot give yet and why.',
  );
  lines.push('- If the learner named a condition, name it back and offer the test that would meet it.');
  lines.push('- If the learner offered a test, accept or decline it in words.');
  lines.push('- If the learner asked you to choose or confirm, hand the choice back with a small step they can take.');
  lines.push(
    '- If the learner claimed a node without warrant and you hold the challenge right, ask for the missing premise by name.',
  );
  return lines.join('\n');
}

/** Rights that a tutor move on the board needs. */
export const TUTOR_STUB_SCOREBOARD_MOVE_RIGHTS = Object.freeze({
  challenge_issued: 'challenge',
  commitment_undertaken: 'close',
});

/**
 * Audit the completed tutor row of one turn against the licence in force.
 * Only text-sourced and family-sourced challenges count as moves the tutor
 * chose; the reader's state-derived challenge (a scope statement while the
 * learner's claim is unwarranted) is a refusal to release, which is always the
 * tutor's right.
 */
export function auditTutorStubScoreboardLicence(board, { turn } = {}) {
  const { tutor } = tutorStubScoreboardRowsAt(board, turn);
  if (!tutor) return { ok: true, turn, rights: [], violations: [], row: null };
  const rights = new Set(tutor.provenance?.tutorRights || []);
  const violations = [];
  for (const m of tutor.marks || []) {
    if (m.field === 'challenge' && m.value === 'issued' && m.source !== 'state' && !rights.has('challenge')) {
      violations.push({
        move: 'challenge_issued',
        needs: 'challenge',
        node: m.node || null,
        span: m.span || null,
        rule: m.rule,
      });
    }
    if (m.field === 'commitment_undertaken' && m.value !== NONE && m.value !== UNREAD && !rights.has('close')) {
      violations.push({
        move: 'commitment_undertaken',
        needs: 'close',
        node: m.node || null,
        span: m.span || null,
        rule: m.rule,
      });
    }
  }
  return { ok: violations.length === 0, turn, rights: [...rights], violations, row: tutor };
}

/** Short view of one board row for the trace. */
export function tutorStubScoreboardRowDigest(row) {
  if (!row) return null;
  return {
    turn: row.turn,
    speaker: row.speaker,
    fields: Object.fromEntries(
      Object.entries(row.fields || {}).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => x.premiseId || x) : v]),
    ),
    marks: (row.marks || []).map((m) => ({
      field: m.field,
      value: m.value,
      node: m.node ?? null,
      rule: m.rule ?? null,
      span: m.span ? clip(m.span) : null,
      ...(m.entitlement ? { entitlement: m.entitlement } : {}),
      ...(m.source ? { source: m.source } : {}),
    })),
    tutorRights: row.provenance?.tutorRights || undefined,
  };
}

/**
 * Turn-loop hook, before the tutor call. Builds the live board from the trace
 * file plus the current turn as it stands, records the read in the trace, and
 * stores the projection on `state.scoreboard` for the tutor prompt. The blind
 * arm stores `projection: null`.
 */
export function observeTutorStubScoreboardBeforeTutor({
  state,
  tutorTurn,
  turnId = null,
  learnerText,
  classification = null,
  tutorLearnerDag = null,
  humanDiscourseFrame = null,
  releasePacing = null,
  registerSelection = null,
  appendTraceEvent = null,
} = {}) {
  const policy = state?.register?.policy || null;
  if (!tutorStubScoreboardPolicyActive(policy)) return null;
  if (!state?.trace?.enabled || !state.trace.filePath) {
    throw new Error(`register policy ${policy} needs the trace file: run with --trace-dir, not --no-trace`);
  }
  const pendingRecord = {
    turn: tutorTurn,
    turnId,
    learner: learnerText,
    classification: classification || null,
    tutorLearnerDagUpdate: tutorLearnerDag
      ? {
          preflight: tutorLearnerDag.preflight || null,
          accepted: tutorLearnerDag.accepted || null,
          rejected: tutorLearnerDag.rejected || [],
          extractor: tutorLearnerDag.extractor || null,
          dagFactDropout: tutorLearnerDag.dagFactDropout || null,
        }
      : null,
    proofDebt: humanDiscourseFrame?.proofDebt ?? null,
    releasePacing: releasePacing || null,
    warrantGateDecision: registerSelection?.warrant_gate || null,
    inquiryCompletion: registerSelection?.warrant_gate?.inquiry_completion || null,
    tutor: null,
  };
  const board = buildTutorStubLiveScoreboard({
    tracePath: state.trace.filePath,
    world: state.world || null,
    pendingRecord,
  });
  const rows = tutorStubScoreboardRowsAt(board, tutorTurn);
  const readsBoard = tutorStubScoreboardPolicyReadsBoard(policy);
  const projection = readsBoard ? projectTutorStubScoreboardContext(board, { turn: tutorTurn }) : null;
  const observation = {
    policy,
    turn: tutorTurn,
    readsBoard,
    projection,
    tutorRights: rows.tutor?.provenance?.tutorRights || [],
    learnerRow: tutorStubScoreboardRowDigest(rows.learner),
    unread: board.unread,
    rowsRead: board.rows.length,
  };
  state.scoreboard = observation;
  if (typeof appendTraceEvent === 'function') {
    appendTraceEvent(state.trace, {
      type: 'scoreboard_read',
      turn: tutorTurn,
      turnId,
      policy,
      projected: Boolean(projection),
      tutorRights: observation.tutorRights,
      learnerRow: observation.learnerRow,
      unread: board.unread,
      rowsRead: board.rows.length,
      publicTranscriptChanged: false,
    });
  }
  return observation;
}

/** The prompt block for this turn, or null. Read by the tutor turn preparation. */
export function tutorStubScoreboardAdvisory(state, { tutorTurn = null } = {}) {
  const observation = state?.scoreboard;
  if (!observation) return null;
  // The observation is set just before this turn's tutor call; the turn count
  // on state is the same clock the turn loop used to stamp it.
  const currentTurn = Array.isArray(state?.turns) ? state.turns.length + 1 : tutorTurn;
  if (Number(observation.turn) !== Number(currentTurn)) return null;
  return observation.projection || null;
}

/**
 * Turn-loop hook, after the turn record is complete. Rebuilds the board with
 * the tutor's line in place and checks the tutor's moves against the licence.
 * Board arm: a violation is recorded and thrown, which ends the dialogue.
 * Blind arm: recorded only.
 */
export function auditTutorStubScoreboardAfterTurn({
  state,
  tutorTurn,
  turnId = null,
  turnRecord,
  appendTraceEvent = null,
} = {}) {
  const policy = state?.register?.policy || null;
  if (!tutorStubScoreboardPolicyActive(policy)) return null;
  const board = buildTutorStubLiveScoreboard({
    tracePath: state.trace.filePath,
    world: state.world || null,
    pendingRecord: turnRecord,
  });
  const audit = auditTutorStubScoreboardLicence(board, { turn: tutorTurn });
  const digest = tutorStubScoreboardRowDigest(audit.row);
  if (typeof appendTraceEvent === 'function') {
    appendTraceEvent(state.trace, {
      type: 'scoreboard_licence_audit',
      turn: tutorTurn,
      turnId,
      policy,
      ok: audit.ok,
      tutorRights: audit.rights,
      violations: audit.violations,
      tutorRow: digest,
      publicTranscriptChanged: false,
    });
  }
  if (!audit.ok && tutorStubScoreboardPolicyReadsBoard(policy)) {
    const first = audit.violations[0];
    const message = `scoreboard licence violation at turn ${tutorTurn}: the tutor made the move ${first.move} without the right ${first.needs} (rights in force: ${audit.rights.join(', ') || 'none'})`;
    if (typeof appendTraceEvent === 'function') {
      appendTraceEvent(state.trace, {
        type: 'scoreboard_licence_violation',
        turn: tutorTurn,
        turnId,
        policy,
        message,
        violations: audit.violations,
        publicTranscriptChanged: false,
      });
    }
    throw new TutorStubScoreboardLicenceViolation(message, { turn: tutorTurn, policy, ...audit, row: digest });
  }
  return { ...audit, row: digest };
}
