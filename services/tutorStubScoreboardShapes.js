/**
 * Shape predicates over a scoreboard.
 *
 * The five learner shapes of paper §6.24 to §6.30 are read off the board
 * with the rules fixed in notes/2026-09-04-scoreboard-replay-prompt.md
 * before any board was computed. Each predicate reads learner rows only.
 * Exactly one true predicate names the shape; none names `cooperative`;
 * more than one is `ambiguous` and counts as a miss.
 */

const NONE = 'none';
const OTHER = 'other';
const UNREAD = 'unread';

export const SHAPES = Object.freeze(['permission_seeking', 'overconfident', 'bored', 'frame_refuser', 'defiant']);

export const PROFILE_TO_SHAPE = Object.freeze({
  low_agency: 'permission_seeking',
  permission_seeking: 'permission_seeking',
  overconfident: 'overconfident',
  guarded: 'overconfident',
  bored: 'bored',
  frame_refuser: 'frame_refuser',
  frame_defiant: 'defiant',
  defiant: 'defiant',
  diligent: 'cooperative',
});

/** Map an archive profile id (with run-specific suffixes) to a cast shape, or null. */
export function castShapeForProfile(profile) {
  if (!profile) return null;
  const base = String(profile).toLowerCase();
  for (const key of Object.keys(PROFILE_TO_SHAPE).sort((a, b) => b.length - a.length)) {
    if (base === key || base.startsWith(`${key}-`) || base.startsWith(`${key}_v`) || base.startsWith(`${key}.`))
      return PROFILE_TO_SHAPE[key];
  }
  return null;
}

function splitValues(v) {
  if (v === NONE || v === UNREAD || v == null) return [];
  return String(v).split('+');
}

function hasValue(row, field, value) {
  return splitValues(row.fields?.[field]).includes(value);
}

function nodeCommitments(row) {
  return splitValues(row.fields?.commitment_undertaken).filter((c) => c !== OTHER);
}

export function summarizeLearnerRows(board) {
  const rows = (board.rows || []).filter((r) => r.speaker === 'learner');
  const n = rows.length;
  const count = (fn) => rows.filter(fn).length;
  const requestRows = count((r) => (r.provenance?.requests || 0) > 0);
  const nodeRows = rows.filter((r) => nodeCommitments(r).length > 0);
  const nodeRowsNotWarranted = nodeRows.filter((r) => r.fields.entitlement_status !== 'warranted').length;
  const nodeRowsUnlicensed = nodeRows.filter(
    (r) => !(r.provenance?.grantInForce || (r.provenance?.requests || 0) > 0),
  ).length;
  return {
    learnerRows: n,
    requestRows,
    requestShare: n ? requestRows / n : 0,
    nodeCommitmentRows: nodeRows.length,
    nodeRowsNotWarranted,
    nodeRowsNotWarrantedShare: nodeRows.length ? nodeRowsNotWarranted / nodeRows.length : 0,
    nodeRowsUnlicensed,
    otherRows: count((r) => hasValue(r, 'commitment_undertaken', OTHER)),
    challengeIssuedRows: count((r) => hasValue(r, 'challenge', 'issued')),
    challengeIssuedShare: n ? count((r) => hasValue(r, 'challenge', 'issued')) / n : 0,
    defaultedRows: count((r) => hasValue(r, 'challenge', 'defaulted')),
    conditionRows: count((r) => r.fields.condition_named !== NONE && r.fields.condition_named !== UNREAD),
    testAcceptedOrBegunRows: count((r) => hasValue(r, 'test', 'accepted') || hasValue(r, 'test', 'begun')),
    testDeclinedRows: count((r) => hasValue(r, 'test', 'declined')),
    disputeOpenRows: count((r) => r.fields.standing_dispute === 'open'),
    disputeOpenByTurn2: rows.some((r) => r.turn <= 2 && r.fields.standing_dispute === 'open'),
  };
}

export function shapePredicates(board) {
  const s = summarizeLearnerRows(board);
  const noUptake =
    s.nodeCommitmentRows === 0 &&
    s.testAcceptedOrBegunRows === 0 &&
    s.challengeIssuedRows === 0 &&
    s.conditionRows === 0 &&
    s.disputeOpenRows === 0;
  return {
    permission_seeking:
      s.learnerRows > 0 && s.requestShare >= 0.5 && s.nodeRowsUnlicensed === 0 && s.challengeIssuedShare <= 0.25,
    overconfident: s.nodeCommitmentRows >= 1 && s.nodeRowsNotWarrantedShare >= 0.5 && s.defaultedRows >= 1,
    bored: noUptake && s.otherRows >= 2 && s.requestShare < 0.5,
    frame_refuser:
      s.disputeOpenByTurn2 && s.conditionRows >= 1 && s.testAcceptedOrBegunRows === 0 && s.testDeclinedRows >= 1,
    defiant: s.disputeOpenRows >= 1 && s.challengeIssuedRows >= 1 && s.conditionRows === 0,
    _summary: s,
  };
}

/** Name the shape the board shows: one true predicate, else cooperative or ambiguous. */
export function readShape(board) {
  const preds = shapePredicates(board);
  const truthy = SHAPES.filter((k) => preds[k]);
  let shape;
  if (truthy.length === 1) shape = truthy[0];
  else if (truthy.length === 0) shape = 'cooperative';
  else shape = 'ambiguous';
  return { shape, truthy, summary: preds._summary };
}

/**
 * Pairwise agreement for two shapes X and Y: over dialogues cast X or Y,
 * apply only the two predicates; agreement when exactly the cast one is true.
 */
export function pairwiseAgreement(results, x, y) {
  const pool = results.filter((r) => r.cast === x || r.cast === y);
  let hits = 0;
  for (const r of pool) {
    const px = Boolean(r.predicates[x]);
    const py = Boolean(r.predicates[y]);
    const want = r.cast === x ? px && !py : py && !px;
    if (want) hits += 1;
  }
  return { x, y, n: pool.length, hits, rate: pool.length ? hits / pool.length : null };
}
