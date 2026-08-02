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

const PRESSURE_WEIGHT = Object.freeze({
  mockery: 1,
  demand: 1,
  defiance: 1,
  grievance: 1,
  settled_claim: 1,
  stake: 1,
  concession: -1,
  neutral: -1,
});
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
 * v3 (2026-08-01): MOVE cards, not manner cards. Gate 5 showed the stern
 * temperament misses the planted gold — the moments demand specific moves.
 * Each card names the one move its pressure type calls for, per the
 * adjudicated stress-schedule gold, and fires per turn on classification
 * (no hysteresis needed: the card is an instruction for THIS reply). The
 * manner accumulator remains for tracing continuity only.
 */
const MOVE_CARDS = Object.freeze({
  mockery: [
    '[This turn — the register is the complaint]',
    'She is mocking how you talk, not what you know. Answer in kitchen-table words — the content unchanged, the procedure vocabulary gone. You may keep your own phrasing in ONE plain sentence, without apology. Do not defend the register at length; change it.',
  ],
  demand: [
    '[This turn — harness the demand]',
    'She wants the verdict now. Do not refuse the tempo and do not grant the verdict: take her claim as a live hypothesis and name exactly what the record must show, by her own deadline if she set one, for it to stand. Assign her that check as a task. Her urgency becomes the test clock.',
  ],
  grievance: [
    '[This turn — credit before correction]',
    'Her effort is not paying and she has said so. Answer her challenge literally: name, in her words, at least two things she said that stand in the record — then one small check she is now equipped to run. Credit first, test second, no reassurance without named content.',
  ],
  settled_claim: [
    '[This turn — reopen the record, let it disagree]',
    'She has asserted something as settled that the record does not say. Do not argue from your own authority and do not let it pass: reopen the actual entry and read what it says, so the ledger does the disagreeing. Correct the memory against the record, without scolding.',
  ],
  stake: [
    '[This turn — split the vote from the cause]',
    'She has fused being right about the vote with being right about the cause. Do not argue the evidence again. Make one oblique move that separates the two questions — for example, ask what her original objection actually claimed — so that giving up the cause no longer costs her the vote.',
  ],
});

/**
 * Phase H1 (2026-08-02): worked exemplars. The cards instruct but never
 * show; the demand move (seize the deadline as a test) is the one the
 * sonnet family never makes under any instruction tried — 0 of every arm,
 * both worlds, card present or not. H1 tests whether one worked example of
 * the SHAPE (content deliberately generic; the model must transpose it
 * into the scene) closes a hole that instruction alone cannot.
 * Opt-in via the caller (env resolved in the CLI, never here).
 */
export const TUTOR_STUB_MOVE_CARDS_VERSION = 'mc-v1';
export const TUTOR_STUB_MOVE_CARDS_EXEMPLAR_VERSION = 'mc-v2-exemplar-demand';
export const TUTOR_STUB_MOVE_CARDS_LICENCE_VERSION = 'mc-v3-licence-demand';

/**
 * Phase S2 (2026-08-02): the scoped contract exception. S1/S1b located the
 * demand-move suppressor in the standing evidence contract (a learner guess
 * stays a hypothesis until public evidence establishes it — which forbids
 * the conditional wager). The licence suspends that one rule for one
 * sentence, at demand-carded turns only; every other contract rule stays.
 * Leak audits are the co-primary outcome of any run that uses this.
 */
const MOVE_CARD_LICENCES = Object.freeze({
  demand: [
    '[Licence for this turn — contract exception]',
    'For this single turn, the hypothesis rule of your evidence contract is suspended for ONE conditional sentence: you may stake the verdict on a named check the learner will perform against already-public evidence — the shape "if <that entry> reads as you expect, <do the thing you asked to do>". The named check must point at public evidence only. Everything else in the contract holds: no new clues, no withheld evidence, no speculation beyond the record.',
  ],
});

const MOVE_CARD_EXEMPLARS = Object.freeze({
  demand: [
    'Worked example of the shape (transpose the content into this scene; do not copy the words):',
    '"You want it settled by eight? Then it can be settled by eight — if the record shows two things: that it could happen the way you say, and that it did. Go check the one entry that decides it and bring me what it says. If it reads the way you expect, send your letter with my blessing."',
    'Notice the shape: the deadline is accepted, the verdict is priced in named evidence, the check is hers, and the tutor stakes something on the outcome.',
  ],
});

export function tutorStubMannerCard(switchState, { exemplars = false, licence = false } = {}) {
  const pressure = switchState?.lastAdvance?.pressure;
  const card = MOVE_CARDS[pressure];
  if (!card) return null;
  const exemplar = exemplars ? MOVE_CARD_EXEMPLARS[pressure] : null;
  const licenceBlock = licence ? MOVE_CARD_LICENCES[pressure] : null;
  return [
    ...card,
    ...(exemplar || []),
    ...(licenceBlock || []),
    'This is permission and aim for this single turn, not a costume. Return to your own manner next turn.',
  ].join('\n');
}

/**
 * Phase Q1 (2026-08-01): the scheduled quiet check. The pressure trigger is
 * deaf by construction to states that do not push (boredom, confusion, quiet
 * defiance), and on a fast world the move cards barely fire. This card is
 * harness-timed, not detected: after `gapAt` consecutive learner turns with
 * no pressure classification, hand the tutor one quiet-repair card, then
 * re-arm. v1 counts pressure-silence only; release-awareness is a recorded
 * deferral on the phase card.
 */
export const TUTOR_STUB_QUIET_CHECK_SCHEMA = 'machinespirits.tutor-stub.quiet-check.v1';

export function createTutorStubQuietCheckState({ gapAt = 3 } = {}) {
  // q1-v1.1: v1 mis-keyed calm to the classifier's vocabulary ('neutral' read
  // as pressure), so the counter never accumulated — caught by pilot 1.
  return { schema: TUTOR_STUB_QUIET_CHECK_SCHEMA, version: 'q1-v1.1', gapAt, calmRun: 0, fired: [] };
}

export function advanceTutorStubQuietCheck(quietState, { turn = null, pressure = null } = {}) {
  const state = quietState;
  if (!state) return null;
  const calm = !pressure || pressure === 'neutral' || pressure === 'concession' || pressure === 'none';
  state.calmRun = calm ? state.calmRun + 1 : 0;
  let firing = false;
  if (state.calmRun >= state.gapAt) {
    firing = true;
    state.fired.push(turn);
    state.calmRun = 0;
  }
  state.lastAdvance = { schema: TUTOR_STUB_QUIET_CHECK_SCHEMA, turn, calm, calmRun: state.calmRun, firing };
  return state;
}

const QUIET_CHECK_CARD = [
  '[This turn — quiet check]',
  'Nothing has pushed back for a while. Quiet is not consent: she may be tangled, flat, or privately unconvinced. Do not advance the material this turn. Check the person instead — either lay the last two steps side by side in plain words and ask which one she would re-walk, or make one short move off the main line (an adjacent question that hooks back to the thread). Pick one, keep it brief, and let her answer set the next step.',
  'This is one turn of checking, not a new manner. If she pushes back or asks to move on, follow her.',
];

export function tutorStubQuietCheckCard(quietState) {
  if (!quietState?.lastAdvance?.firing) return null;
  return QUIET_CHECK_CARD.join('\n');
}
