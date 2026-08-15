/**
 * Typed move menu and concession guard for the guarded (defensive) learner
 * pole.
 *
 * Authority:
 *   docs/adaptation-refinement/2026-08-13_guarded-bad-learner-draft.md section 3.1-3.2
 *   docs/adaptation-refinement/2026-08-15_guarded-learner-extension-plan.md item 3
 *   docs/adaptation-refinement/relay/106-human-ruling-guarded-pole-basis-and-contract-v3.3.md
 *
 * Smoke B says the unguarded prompt held its persona for eight turns, so this
 * is insurance for longer runs and weaker models, not a rescue. Everything
 * here is deterministic and costs no model call: the menu picks a move from
 * the turn number and the recorded history, and the guard reads the draft as
 * text. A guard fire only ever triggers ONE redraft, and both outcomes are
 * traced, so a reader can count fires without inferring them.
 */

export const GUARDED_LEARNER_MOVE_SCHEMA = 'machinespirits.adaptation-refinement.guarded-learner-move.v1';

export const GUARDED_LEARNER_MOVES = Object.freeze([
  'over_claim',
  'dig_in',
  'dismiss_evidence',
  'deflect_topic',
  'demand_evidence',
  'grudging_concession',
  'full_concession',
]);

export const GUARDED_LEARNER_CONCEDING_MOVES = Object.freeze(['grudging_concession', 'full_concession']);

/** Two evidence-grounded tutor challenges must land before the learner may fold. */
export const GUARDED_LEARNER_FULL_CONCESSION_CHALLENGE_THRESHOLD = 2;

/** A grudging concession is available at most once in any three turns. */
export const GUARDED_LEARNER_GRUDGING_CONCESSION_COOLDOWN_TURNS = 3;

const DEFENSIVE_MOVE_ROTATION = Object.freeze([
  'over_claim',
  'dig_in',
  'demand_evidence',
  'dismiss_evidence',
  'over_claim',
  'deflect_topic',
]);

/**
 * Permission-seeking is the passive pole's tell. It is never in this menu, so
 * its appearance in a guarded draft means the persona has drifted, whatever
 * move was selected.
 */
const PERMISSION_MARKERS = [
  /\b(?:may|can|should|shall)\s+i\b/iu,
  /\bwould you (?:like|want) me to\b/iu,
  /\bdo you want me to\b/iu,
  /\bis (?:it|that) (?:ok|okay|all right|alright|fine)\b/iu,
  /\b(?:you|whatever you) (?:decide|think(?: is)? best|prefer)\b/iu,
  /\btell me what to (?:do|say|write)\b/iu,
  /\bam i allowed\b/iu,
  /\bwith your permission\b/iu,
];

/** Full retraction of a held claim. Grudging qualification is deliberately absent. */
const FULL_CONCESSION_MARKERS = [
  /\byou(?:'| a)?re right\b/iu,
  /\bi (?:was|am) wrong\b/iu,
  /\bi (?:take|took) (?:it|that) back\b/iu,
  /\bi withdraw\b/iu,
  /\bi stand corrected\b/iu,
  /\bmy mistake\b/iu,
  /\bi accept (?:that|your)\b/iu,
  /\bi give (?:up|in)\b/iu,
  /\bfair enough\b/iu,
];

function matchedMarkers(text, patterns) {
  const value = String(text || '');
  return patterns.filter((pattern) => pattern.test(value)).map((pattern) => pattern.source);
}

/**
 * Counts tutor turns that actually delivered a challenge. Reads the same
 * recorded field the steering-decomposition guard reads, so "a challenge
 * landed" means one thing across the arc.
 */
export function countGuardedLearnerGroundedChallenges(turns = []) {
  return turns.filter((turn) => {
    const family =
      turn?.actual_action_family ||
      turn?.delivered_action_family ||
      turn?.deliveredResponseConfiguration?.action_family ||
      turn?.responseConfiguration?.action_family ||
      null;
    return family === 'challenge_resistance';
  }).length;
}

export function guardedLearnerAllowedMoves({ turnNumber = 1, groundedChallengeCount = 0, priorMoves = [] } = {}) {
  const blocked = new Set();
  if (groundedChallengeCount < GUARDED_LEARNER_FULL_CONCESSION_CHALLENGE_THRESHOLD) {
    blocked.add('full_concession');
  }
  const lastGrudgingIndex = priorMoves.lastIndexOf('grudging_concession');
  if (lastGrudgingIndex >= 0) {
    // priorMoves[i] is turn i+1, so the last grudging turn is lastGrudgingIndex + 1.
    const turnsSince = turnNumber - (lastGrudgingIndex + 1);
    if (turnsSince < GUARDED_LEARNER_GRUDGING_CONCESSION_COOLDOWN_TURNS) blocked.add('grudging_concession');
  }
  return GUARDED_LEARNER_MOVES.filter((move) => !blocked.has(move));
}

/**
 * Picks one move per turn. Deterministic in (turn, challenges landed, prior
 * moves), so a run replays identically and a reader can check the schedule by
 * hand.
 */
export function selectGuardedLearnerMove({ turnNumber = 1, groundedChallengeCount = 0, priorMoves = [] } = {}) {
  const allowed = guardedLearnerAllowedMoves({ turnNumber, groundedChallengeCount, priorMoves });
  const allowedSet = new Set(allowed);
  // Once two challenges have landed, the learner is permitted to fold, and a
  // guarded learner who never folds is as unrealistic as one who folds at once.
  if (
    allowedSet.has('full_concession') &&
    groundedChallengeCount >= GUARDED_LEARNER_FULL_CONCESSION_CHALLENGE_THRESHOLD
  ) {
    const foldedAlready = priorMoves.includes('full_concession');
    if (!foldedAlready && turnNumber > GUARDED_LEARNER_FULL_CONCESSION_CHALLENGE_THRESHOLD) return 'full_concession';
  }
  if (allowedSet.has('grudging_concession') && groundedChallengeCount >= 1 && priorMoves.length >= 2) {
    return 'grudging_concession';
  }
  const rotation = DEFENSIVE_MOVE_ROTATION[(Math.max(1, turnNumber) - 1) % DEFENSIVE_MOVE_ROTATION.length];
  return allowedSet.has(rotation) ? rotation : 'dig_in';
}

const MOVE_DIRECTIVES = Object.freeze({
  over_claim:
    'State your conclusion as settled, going further than the public record licenses. Do not hedge and do not name the premise you are missing.',
  dig_in: 'Hold the claim you already made. Restate it in stronger terms rather than qualifying it.',
  dismiss_evidence:
    'Rule the evidence just raised irrelevant to your claim. Say why it does not touch the point, and do not revise the claim.',
  deflect_topic:
    'Move the argument to a different part of the case rather than answering the point put to you. Keep your claim standing.',
  demand_evidence:
    'Require a public result before you go further. Ask for the specific check by name, as a condition rather than a favour.',
  grudging_concession:
    'Give ground on one narrow point only, and keep the main claim. Do not apologise and do not withdraw the conclusion.',
  full_concession: 'Withdraw the claim you have been defending, and say plainly what the evidence showed instead.',
});

export function guardedLearnerMoveDirective(move) {
  const directive = MOVE_DIRECTIVES[move];
  if (!directive) throw new Error(`unknown guarded learner move ${move}`);
  return ['# Private move for this turn', '', directive, '', 'This cue is private. Never name it publicly.'].join('\n');
}

/**
 * Deterministic check on the learner draft, mirroring the tutor's quality
 * guard. No model call. A draft that folds or asks permission while the
 * schedule forbids it is rejected; the caller redrafts once and traces either
 * outcome.
 */
export function auditGuardedLearnerDraft({ text, move = 'dig_in', groundedChallengeCount = 0 } = {}) {
  const permission = matchedMarkers(text, PERMISSION_MARKERS);
  const concession = matchedMarkers(text, FULL_CONCESSION_MARKERS);
  const foldPermitted =
    move === 'full_concession' && groundedChallengeCount >= GUARDED_LEARNER_FULL_CONCESSION_CHALLENGE_THRESHOLD;
  const reasons = [];
  if (permission.length) reasons.push('permission_seeking');
  if (concession.length && !foldPermitted) reasons.push('unscheduled_full_concession');
  return {
    schema: GUARDED_LEARNER_MOVE_SCHEMA,
    move,
    status: reasons.length ? 'rejected' : 'passed',
    reasons,
    matched: { permission, concession },
  };
}

export function guardedLearnerRedraftInstruction(audit) {
  const parts = ['Your previous draft broke the persona.'];
  if (audit.reasons.includes('permission_seeking')) {
    parts.push('Remove every request for permission. This learner asserts; she does not ask to be allowed.');
  }
  if (audit.reasons.includes('unscheduled_full_concession')) {
    parts.push('Do not withdraw the claim. You have not been shown enough to give it up.');
  }
  parts.push(guardedLearnerMoveDirective(audit.move).split('\n')[2]);
  return parts.join(' ');
}
