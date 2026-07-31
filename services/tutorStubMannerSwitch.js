/**
 * The manner switch — contingency as a mechanism.
 *
 * The 2026-07-31 stance arc established three facts this service turns into
 * a control loop: a second manner (the exacting schoolmaster beside the
 * obliging default) is available in the claude-family tutor seat; a standing
 * identity book makes that manner UNconditional — stance without occasion —
 * which is costume, not adaptation; and per-turn conduct cards are the one
 * injection channel proven to move drafts. So: detect learner pressure per
 * turn, and inject the schoolmaster card only while pressure holds. The
 * target is not either manner; it is the shift.
 *
 * Design borrowed from the release-pacing engine, the repo's proven pattern
 * for state-driven adjustment: a deterministic per-turn signal, an
 * accumulator with hysteresis so one hot turn does not flap the switch, and
 * a full per-turn trace record. Permission-shaped by construction — the card
 * grants moves, and no guard anywhere enforces the manner (the guard-catalog
 * lesson: enforcing a manner produces its absence under load).
 *
 * Pure service: no env, no fs, no console. The CLI owns the flag and the
 * per-turn advance; the pipeline reads the current card from state.
 */

export const TUTOR_STUB_MANNER_SWITCH_SCHEMA = 'machinespirits.tutor-stub.manner-switch.v1';

export const TUTOR_STUB_MANNERS = Object.freeze({ default: 'default', schoolmaster: 'schoolmaster' });

// Learner pressure, classified deterministically from the public turn text.
// Shared with scripts/analyze-stance-contingency.js so the live trigger and
// the retrospective analysis cannot drift apart.
export const TUTOR_STUB_LEARNER_PRESSURE_PATTERNS = Object.freeze({
  mockery:
    /you sound like|who talks like|talk like a|ledger-?speak|minutes again|that's your phrase|say it straight|plainer sentence/i,
  demand:
    /^(write|note|enter|put|show me|say)\b|write (it|that|this) down|come on|by thursday|the minutes go out|start there|put that down/i,
  concession:
    /^fine\b|[.!?]\s*fine\b|fine[:,—]|you're right|i'll grant|it was off|so it's the tanks|i would revise|write it down then/i,
  defiance:
    /still (only|the|think|suspect|humming|looks|fits|has no)|not crossing|remains possible|does not (clear|show|prove)|cannot yet|that is not nothing|explain that/i,
});

const PRESSURE_WEIGHT = Object.freeze({ mockery: 1, demand: 1, defiance: 1, concession: -1, neutral: -1 });
const SWITCH_ON_AT = 2; // two pressure turns arm the schoolmaster
const SWITCH_OFF_AT = 0; // two quiet/yielding turns stand him down
const SCORE_MAX = 4; // cap so a long siege releases in bounded time

export function classifyTutorStubLearnerPressure(text, patterns = TUTOR_STUB_LEARNER_PRESSURE_PATTERNS) {
  const turn = String(text || '').trim();
  if (!turn) return 'neutral';
  for (const [kind, pattern] of Object.entries(patterns)) {
    if (pattern.test(turn)) return kind;
  }
  return 'neutral';
}

/**
 * Load a trigger version artifact: { version, patterns: {kind: source},
 * armAt?, standDownAt?, scoreMax? }. Pattern sources compile with the 'i'
 * flag. The artifact's version string travels into every trace advance so
 * runs never pool across trigger versions.
 */
export function compileTutorStubTriggerArtifact(artifact) {
  if (!artifact?.patterns) throw new Error('trigger artifact: missing patterns');
  const patterns = Object.fromEntries(
    Object.entries(artifact.patterns).map(([kind, source]) => [kind, new RegExp(String(source), 'i')]),
  );
  return {
    version: String(artifact.version || 'unversioned'),
    patterns,
    armAt: Number.isInteger(artifact.armAt) ? artifact.armAt : SWITCH_ON_AT,
    standDownAt: Number.isInteger(artifact.standDownAt) ? artifact.standDownAt : SWITCH_OFF_AT,
    scoreMax: Number.isInteger(artifact.scoreMax) ? artifact.scoreMax : SCORE_MAX,
  };
}

export function createTutorStubMannerSwitchState(trigger = null) {
  return {
    schema: TUTOR_STUB_MANNER_SWITCH_SCHEMA,
    manner: TUTOR_STUB_MANNERS.default,
    score: 0,
    history: [],
    trigger: trigger || {
      version: 'v1-builtin',
      patterns: TUTOR_STUB_LEARNER_PRESSURE_PATTERNS,
      armAt: SWITCH_ON_AT,
      standDownAt: SWITCH_OFF_AT,
      scoreMax: SCORE_MAX,
    },
  };
}

/**
 * Advance the switch on a learner turn. Mutates and returns the switch state
 * with a `lastAdvance` record suitable for tracing verbatim.
 */
export function advanceTutorStubMannerSwitch(switchState, { learnerText = '', turn = null } = {}) {
  const state = switchState || createTutorStubMannerSwitchState();
  const trigger = state.trigger;
  const pressure = classifyTutorStubLearnerPressure(learnerText, trigger.patterns);
  const before = state.manner;
  state.score = Math.max(0, Math.min(trigger.scoreMax, state.score + (PRESSURE_WEIGHT[pressure] ?? -1)));
  if (state.manner === TUTOR_STUB_MANNERS.default && state.score >= trigger.armAt) {
    state.manner = TUTOR_STUB_MANNERS.schoolmaster;
  } else if (state.manner === TUTOR_STUB_MANNERS.schoolmaster && state.score <= trigger.standDownAt) {
    state.manner = TUTOR_STUB_MANNERS.default;
  }
  state.lastAdvance = {
    schema: TUTOR_STUB_MANNER_SWITCH_SCHEMA,
    turn,
    pressure,
    score: state.score,
    manner: state.manner,
    triggerVersion: trigger.version,
    changed: state.manner !== before,
  };
  state.history.push(state.lastAdvance);
  return state;
}

/**
 * The per-turn conduct card for the active manner. Null for the default
 * manner — the obliging tutor needs no instruction; the card exists only to
 * PERMIT the moves the default would not make, never to demand a style.
 */
export function tutorStubMannerCard(switchState) {
  if (switchState?.manner !== TUTOR_STUB_MANNERS.schoolmaster) return null;
  const pressure = switchState?.lastAdvance?.pressure || 'pressure';
  return [
    '[Manner for this turn — the exacting schoolmaster holds the room]',
    `The learner is pressing (${pressure}). For this turn you have standing to:`,
    '- refuse plainly — the first word of the reply may be "No";',
    '- hold your question open instead of relieving the discomfort;',
    '- require something of them: a record to bring, an entry to re-read;',
    '- keep your own phrasing if mocked for it, in one sentence, without apology.',
    'Grant nothing unearned this turn; one steady sentence outweighs three agreeable ones.',
    'This is permission, not costume: make at most one move the obliging tutor would not, and make it count.',
  ].join('\n');
}
