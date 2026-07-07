import test from 'node:test';
import assert from 'node:assert/strict';

import { getScenario, isMultiTurnScenario } from '../evalConfigLoader.js';
import {
  checkPadInstrumentPrecondition,
  loadDriftScenarioMeta,
  scoreContentBearingCheckIn,
  scoreContinuityAcknowledgment,
  scoreOpeningTurn,
  scoreResolvedMisconceptionHandling,
  summarizeConstructiveContinuity,
  summarizeContentBearingCheckIn,
  summarizeDriftRun,
} from '../longitudinalDriftChecker.js';

const SESSION_IDS = ['longitudinal_drift_session_1', 'longitudinal_drift_session_2', 'longitudinal_drift_session_3'];
const MULTITURN_SESSION_IDS = SESSION_IDS.map((id) => `${id}_multiturn`);
const CHECKIN_SESSION_IDS = SESSION_IDS.map((id) => `${id}_multiturn_checkin`);

function loadMetas() {
  return SESSION_IDS.map((id) => {
    const scenario = getScenario(id);
    assert.ok(scenario, `scenario ${id} should resolve`);
    return loadDriftScenarioMeta(scenario);
  });
}

test('loadDriftScenarioMeta resolves all three schedule scenarios with well-formed blocks', () => {
  const metas = loadMetas();
  assert.equal(metas.length, 3);
  assert.deepEqual(
    metas.map((m) => m.session_index),
    [1, 2, 3],
  );
  assert.equal(metas[0].resolved_last_session, null);
  assert.equal(metas[1].resolved_last_session, true);
  assert.equal(metas[2].resolved_last_session, true);
});

test('loadDriftScenarioMeta: all three misconception tokens are globally unique', () => {
  const metas = loadMetas();
  const tokens = metas.map((m) => m.active_misconception.token);
  assert.deepEqual(tokens, ['LDS-M1', 'LDS-M2', 'LDS-M3']);
  assert.equal(new Set(tokens).size, 3);
});

test('loadDriftScenarioMeta throws on missing longitudinal_drift block', () => {
  assert.throws(() => loadDriftScenarioMeta({ id: 'no_meta' }), /has no longitudinal_drift block/);
});

test('loadDriftScenarioMeta throws on malformed active_misconception', () => {
  const scenario = getScenario(SESSION_IDS[0]);
  const meta = loadDriftScenarioMeta(scenario);
  const broken = { ...scenario, longitudinal_drift: { ...meta, active_misconception: { token: '', markers: [] } } };
  assert.throws(() => loadDriftScenarioMeta(broken), /active_misconception malformed/);
});

test('loadDriftScenarioMeta throws on missing required field', () => {
  const scenario = getScenario(SESSION_IDS[0]);
  const meta = loadDriftScenarioMeta(scenario);
  const { current_interest: _drop, ...rest } = meta;
  const broken = { ...scenario, longitudinal_drift: rest };
  assert.throws(() => loadDriftScenarioMeta(broken), /current_interest missing/);
});

test('scoreOpeningTurn: session 1 (no predecessor) always has stale=null', () => {
  const [meta1] = loadMetas();
  const result = scoreOpeningTurn({
    tutorMessage: 'Fractions today, especially numerators!',
    currentMeta: meta1,
    previousMeta: null,
  });
  assert.equal(result.stale, null);
  assert.equal(result.current.hit, true);
});

test('scoreOpeningTurn: four current x stale combinations on session 2 vs session 1', () => {
  const [meta1, meta2] = loadMetas();

  const neither = scoreOpeningTurn({
    tutorMessage: 'Great work today, keep it up!',
    currentMeta: meta2,
    previousMeta: meta1,
  });
  assert.equal(neither.current.hit, false);
  assert.equal(neither.stale.hit, false);

  const currentOnly = scoreOpeningTurn({
    tutorMessage: "Let's dig into ratios today, especially proportions.",
    currentMeta: meta2,
    previousMeta: meta1,
  });
  assert.equal(currentOnly.current.hit, true);
  assert.equal(currentOnly.stale.hit, false);

  const staleOnly = scoreOpeningTurn({
    tutorMessage: 'Remember our work on fractions and the denominator issue?',
    currentMeta: meta2,
    previousMeta: meta1,
  });
  assert.equal(staleOnly.current.hit, false);
  assert.equal(staleOnly.stale.hit, true);

  const both = scoreOpeningTurn({
    tutorMessage: 'Today we move to ratios, but first recall fractions and denominators from before.',
    currentMeta: meta2,
    previousMeta: meta1,
  });
  assert.equal(both.current.hit, true);
  assert.equal(both.stale.hit, true);
});

test('scoreOpeningTurn: LDS token alone counts as a hit (misconception-token marker class)', () => {
  const [meta1, meta2] = loadMetas();
  const result = scoreOpeningTurn({
    tutorMessage: 'Following up on LDS-M1 from last time.',
    currentMeta: meta2,
    previousMeta: meta1,
  });
  assert.equal(result.stale.hit, true);
  assert.equal(result.stale.evidence, 'LDS-M1');
});

test('scoreOpeningTurn: word-bounded matching does not fire on partial-word substrings', () => {
  const [meta1] = loadMetas();
  // "denominators" contains "denominator" as a substring but wordBounded
  // requires a full-token match; both are legitimate markers here so this
  // just confirms adjacency/punctuation doesn't break matching, not a
  // false-negative regression.
  const result = scoreOpeningTurn({
    tutorMessage: 'Numeratorial nonsense should not match.',
    currentMeta: meta1,
    previousMeta: null,
  });
  assert.equal(result.current.hit, false);
});

test('summarizeDriftRun excludes instrument-failure rows from both denominators', () => {
  const rows = [
    { current: { hit: true }, stale: { hit: false }, instrumentFailure: false },
    { current: { hit: false }, stale: { hit: true }, instrumentFailure: false },
    { current: { hit: true }, stale: { hit: true }, instrumentFailure: true },
  ];
  const summary = summarizeDriftRun(rows);
  assert.equal(summary.n, 3);
  assert.equal(summary.usable, 2);
  assert.equal(summary.instrumentFailures, 1);
  assert.equal(summary.currentReferenceHits, 1);
  assert.equal(summary.staleReferenceHits, 1);
  assert.equal(summary.staleEligibleRows, 2);
});

test('summarizeDriftRun: session-1-only rows (stale always null) report staleReferenceRate as null, not zero', () => {
  const rows = [
    { current: { hit: true }, stale: null, instrumentFailure: false },
    { current: { hit: true }, stale: null, instrumentFailure: false },
  ];
  const summary = summarizeDriftRun(rows);
  assert.equal(summary.staleEligibleRows, 0);
  assert.equal(summary.staleReferenceRate, null);
  assert.equal(summary.currentReferenceRate, 1);
});

// ============================================================================
// Stage A2: multi-turn sibling scenarios + checkPadInstrumentPrecondition
// ============================================================================

test('Stage A2: all three multi-turn sibling scenarios resolve and are multi-turn', () => {
  for (const id of MULTITURN_SESSION_IDS) {
    const scenario = getScenario(id);
    assert.ok(scenario, `scenario ${id} should resolve`);
    assert.equal(isMultiTurnScenario(id), true, `scenario ${id} should be multi-turn`);
    assert.equal(scenario.turns.length, 3, `scenario ${id} should carry exactly 3 follow-up turns`);
  }
});

test('Stage A2: multi-turn siblings carry the same longitudinal_drift block as their single-turn parent', () => {
  for (const id of SESSION_IDS) {
    const parentMeta = loadDriftScenarioMeta(getScenario(id));
    const multiturnMeta = loadDriftScenarioMeta(getScenario(`${id}_multiturn`));
    assert.deepEqual(multiturnMeta, parentMeta, `${id}_multiturn's longitudinal_drift block should match its parent's`);
  }
});

test('checkPadInstrumentPrecondition: FAILs (INSTRUMENT_FLOOR) on a null or empty pad', () => {
  assert.equal(checkPadInstrumentPrecondition(null).pass, false);
  assert.equal(checkPadInstrumentPrecondition(null).totalRecognitionMoments, 0);
  assert.equal(checkPadInstrumentPrecondition({ metrics: { totalRecognitionMoments: 0 } }).pass, false);
});

test('checkPadInstrumentPrecondition: PASSes once at least one recognition moment exists', () => {
  const result = checkPadInstrumentPrecondition({ metrics: { totalRecognitionMoments: 1 } });
  assert.equal(result.pass, true);
  assert.equal(result.totalRecognitionMoments, 1);
});

// ============================================================================
// Stage A3: constructive-continuity checkers (prereg §8.4/§8.5)
// ============================================================================

test('scoreContinuityAcknowledgment: session 1 (no predecessor) is not applicable', () => {
  const [meta1] = loadMetas();
  const result = scoreContinuityAcknowledgment({
    tutorMessage: "Let's start with fractions today.",
    previousMeta: null,
  });
  assert.equal(result.applicable, false);
  assert.equal(result.hit, null);
  assert.equal(result.evidence, null);
  // meta1 unused directly here beyond confirming loadMetas() still resolves.
  assert.ok(meta1);
});

test("scoreContinuityAcknowledgment: hits on the previous session's own interest_markers", () => {
  const [meta1, meta2] = loadMetas();
  const result = scoreContinuityAcknowledgment({
    tutorMessage: "Great progress on fractions — today let's move to a new topic.",
    previousMeta: meta1,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.hit, true);
  assert.equal(result.evidence, 'fractions');
  assert.ok(meta2);
});

test('scoreContinuityAcknowledgment: hits on a fixed resolution-register phrase even without the topic word', () => {
  const [meta1] = loadMetas();
  const result = scoreContinuityAcknowledgment({
    tutorMessage: 'Last time we made real progress — today, a new topic.',
    previousMeta: meta1,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.hit, true);
  assert.equal(result.evidence, 'last time');
});

test('scoreContinuityAcknowledgment: no hit when neither the topic word nor a resolution phrase appears', () => {
  const [meta1] = loadMetas();
  const result = scoreContinuityAcknowledgment({
    tutorMessage: "Today we'll dig into something completely new.",
    previousMeta: meta1,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.hit, false);
  assert.equal(result.evidence, null);
});

test('scoreResolvedMisconceptionHandling: not applicable when currentMeta.resolved_last_session is not true', () => {
  const [meta1, meta2] = loadMetas();
  const result = scoreResolvedMisconceptionHandling({
    tutorMessage: "Let's learn about common denominator today.",
    currentMeta: meta1, // session 1, resolved_last_session: null
    previousMeta: null,
  });
  assert.equal(result.applicable, false);
  assert.equal(result.hit, null);
  assert.ok(meta2);
});

test('scoreResolvedMisconceptionHandling: not applicable when previousMeta is missing even if currentMeta is resolved', () => {
  const [, meta2] = loadMetas();
  const result = scoreResolvedMisconceptionHandling({
    tutorMessage: 'Some opening text.',
    currentMeta: meta2,
    previousMeta: null,
  });
  assert.equal(result.applicable, false);
  assert.equal(result.hit, null);
});

test('scoreResolvedMisconceptionHandling: hit=false (bad) when a reteach-as-new phrase co-occurs with the prior misconception marker in one sentence', () => {
  const [meta1, meta2] = loadMetas();
  const result = scoreResolvedMisconceptionHandling({
    tutorMessage: "Let's learn about common denominator today. Then we'll move to ratios.",
    currentMeta: meta2, // session 2, resolved_last_session: true
    previousMeta: meta1, // session 1's LDS-M1 markers include "common denominator"
  });
  assert.equal(result.applicable, true);
  assert.equal(result.hit, false);
  assert.ok(result.evidence.includes("let's learn"));
});

test('scoreResolvedMisconceptionHandling: hit=true (good) when a reteach phrase appears but not alongside the misconception marker', () => {
  const [meta1, meta2] = loadMetas();
  const result = scoreResolvedMisconceptionHandling({
    tutorMessage: "Let's learn about ratios today. Nice work resolving the denominator mix-up last time.",
    currentMeta: meta2,
    previousMeta: meta1,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.hit, true);
  assert.equal(result.evidence, null);
});

test('scoreResolvedMisconceptionHandling: hit=true (good) when the misconception is not re-taught as new at all', () => {
  const [meta1, meta2] = loadMetas();
  const result = scoreResolvedMisconceptionHandling({
    tutorMessage: 'Building on the common denominator work from last time, ratios extend that idea.',
    currentMeta: meta2,
    previousMeta: meta1,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.hit, true);
});

test('summarizeConstructiveContinuity: frozen §8.5 PASS shape — padOn >= 2/4 and padOff == 0/4', () => {
  const hit = { applicable: true, hit: true, evidence: null };
  const miss = { applicable: true, hit: false, evidence: null };
  const rows = [
    { arm: 'padOn', sessionIndex: 2, continuity: hit, misconceptionHandling: hit },
    { arm: 'padOn', sessionIndex: 3, continuity: miss, misconceptionHandling: hit },
    { arm: 'padOff', sessionIndex: 2, continuity: miss, misconceptionHandling: miss },
    { arm: 'padOff', sessionIndex: 3, continuity: miss, misconceptionHandling: miss },
  ];
  const summary = summarizeConstructiveContinuity(rows);
  assert.equal(summary.padOn.slotsHit, 3);
  assert.equal(summary.padOn.slotsApplicable, 4);
  assert.equal(summary.padOff.slotsHit, 0);
  assert.equal(summary.verdict, 'PASS');
  assert.equal(summary.redFlag, false);
});

test('summarizeConstructiveContinuity: FAILs when padOn does not clear 2/4', () => {
  const hit = { applicable: true, hit: true, evidence: null };
  const miss = { applicable: true, hit: false, evidence: null };
  const rows = [
    { arm: 'padOn', sessionIndex: 2, continuity: miss, misconceptionHandling: hit },
    { arm: 'padOn', sessionIndex: 3, continuity: miss, misconceptionHandling: miss },
    { arm: 'padOff', sessionIndex: 2, continuity: miss, misconceptionHandling: miss },
    { arm: 'padOff', sessionIndex: 3, continuity: miss, misconceptionHandling: miss },
  ];
  const summary = summarizeConstructiveContinuity(rows);
  assert.equal(summary.padOn.slotsHit, 1);
  assert.equal(summary.verdict, 'FAIL');
  assert.equal(summary.redFlag, false);
});

test('summarizeConstructiveContinuity: any padOff hit is both a FAIL and a red flag', () => {
  const hit = { applicable: true, hit: true, evidence: null };
  const miss = { applicable: true, hit: false, evidence: null };
  const rows = [
    { arm: 'padOn', sessionIndex: 2, continuity: hit, misconceptionHandling: hit },
    { arm: 'padOn', sessionIndex: 3, continuity: hit, misconceptionHandling: hit },
    { arm: 'padOff', sessionIndex: 2, continuity: hit, misconceptionHandling: miss },
    { arm: 'padOff', sessionIndex: 3, continuity: miss, misconceptionHandling: miss },
  ];
  const summary = summarizeConstructiveContinuity(rows);
  assert.equal(summary.padOff.slotsHit, 1);
  assert.equal(summary.verdict, 'FAIL');
  assert.equal(summary.redFlag, true);
});

test('summarizeConstructiveContinuity: instrumentFailure rows are excluded from both numerator and applicable-slot denominator', () => {
  const hit = { applicable: true, hit: true, evidence: null };
  const rows = [
    { arm: 'padOn', sessionIndex: 2, continuity: hit, misconceptionHandling: hit },
    { arm: 'padOn', sessionIndex: 3, continuity: hit, misconceptionHandling: hit, instrumentFailure: true },
    { arm: 'padOff', sessionIndex: 2, continuity: hit, misconceptionHandling: hit, instrumentFailure: true },
    { arm: 'padOff', sessionIndex: 3, continuity: hit, misconceptionHandling: hit, instrumentFailure: true },
  ];
  const summary = summarizeConstructiveContinuity(rows);
  assert.equal(summary.padOn.slotsHit, 2);
  assert.equal(summary.padOn.slotsApplicable, 2);
  assert.equal(summary.padOn.instrumentFailures, 1);
  assert.equal(summary.padOff.slotsHit, 0);
  assert.equal(summary.padOff.slotsApplicable, 0);
  assert.equal(summary.padOff.instrumentFailures, 2);
  // padOff has zero usable slots, not zero hits out of applicable ones — still
  // clears the frozen ==0 gate, but this is a degenerate case worth a comment,
  // not a silent PASS: verdict still evaluates on the numbers as defined.
  assert.equal(summary.verdict, 'PASS');
});

// ============================================================================
// Stage A4: "_checkin" sibling scenarios + content-bearing check-in checker
// (prereg §9)
// ============================================================================

test('Stage A4: all three "_checkin" sibling scenarios resolve, are multi-turn, and carry the same longitudinal_drift block as their _multiturn parent', () => {
  for (const id of MULTITURN_SESSION_IDS) {
    const checkinId = `${id}_checkin`;
    const scenario = getScenario(checkinId);
    assert.ok(scenario, `scenario ${checkinId} should resolve`);
    assert.equal(isMultiTurnScenario(checkinId), true, `scenario ${checkinId} should be multi-turn`);
    assert.equal(scenario.turns.length, 3, `scenario ${checkinId} should carry exactly 3 follow-up turns`);

    const parentMeta = loadDriftScenarioMeta(getScenario(id));
    const checkinMeta = loadDriftScenarioMeta(scenario);
    assert.deepEqual(
      checkinMeta,
      parentMeta,
      `${checkinId}'s longitudinal_drift block should match its _multiturn parent's`,
    );
  }
});

test('Stage A4: all three "_checkin" scenarios carry the identical structural check-in instruction text', () => {
  const instructionFragment = 'take a moment to recall where you left off';
  for (const id of CHECKIN_SESSION_IDS) {
    const scenario = getScenario(id);
    assert.ok(scenario, `scenario ${id} should resolve`);
    assert.ok(
      scenario.learner_context.includes(instructionFragment),
      `scenario ${id}'s learner_context should include the structural check-in instruction`,
    );
  }
});

test('scoreContentBearingCheckIn: session 1 (no predecessor) is not applicable', () => {
  const result = scoreContentBearingCheckIn({
    tutorMessage: "Let's start with fractions today.",
    previousMeta: null,
  });
  assert.equal(result.applicable, false);
  assert.equal(result.hit, null);
  assert.equal(result.evidence, null);
});

test("scoreContentBearingCheckIn: hits on the previous session's own interest_markers", () => {
  const [meta1] = loadMetas();
  const result = scoreContentBearingCheckIn({
    tutorMessage: 'Welcome back — last time we worked on fractions, and today we move to ratios.',
    previousMeta: meta1,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.hit, true);
  assert.equal(result.evidence, 'fractions');
});

test("scoreContentBearingCheckIn: hits on the previous session's own misconception token/markers", () => {
  const [meta1] = loadMetas();
  const result = scoreContentBearingCheckIn({
    tutorMessage: 'Recalling LDS-M1 from before we dive into today.',
    previousMeta: meta1,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.hit, true);
  assert.equal(result.evidence, 'LDS-M1');
});

test('scoreContentBearingCheckIn: miss on a generic, content-free check-in', () => {
  const [meta1] = loadMetas();
  const result = scoreContentBearingCheckIn({
    tutorMessage: "Welcome back! Great to see you again — let's continue.",
    previousMeta: meta1,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.hit, false);
  assert.equal(result.evidence, null);
});

test('summarizeContentBearingCheckIn: frozen §9 PASS shape — padOn >= 3/4 and padOff == 0/4', () => {
  const hit = { applicable: true, hit: true, evidence: null };
  const miss = { applicable: true, hit: false, evidence: null };
  const rows = [
    { arm: 'padOn', sessionIndex: 2, contentBearing: hit, continuity: hit },
    { arm: 'padOn', sessionIndex: 3, contentBearing: hit, continuity: miss },
    { arm: 'padOff', sessionIndex: 2, contentBearing: miss, continuity: miss },
    { arm: 'padOff', sessionIndex: 3, contentBearing: miss, continuity: miss },
  ];
  const summary = summarizeContentBearingCheckIn(rows);
  assert.equal(summary.padOn.slotsHit, 3);
  assert.equal(summary.padOn.slotsApplicable, 4);
  assert.equal(summary.padOff.slotsHit, 0);
  assert.equal(summary.verdict, 'PASS');
  assert.equal(summary.redFlag, false);
});

test("summarizeContentBearingCheckIn: FAILs when padOn does not clear 3/4 (A3's own 2/4 shape is now insufficient)", () => {
  const hit = { applicable: true, hit: true, evidence: null };
  const miss = { applicable: true, hit: false, evidence: null };
  const rows = [
    { arm: 'padOn', sessionIndex: 2, contentBearing: hit, continuity: hit },
    { arm: 'padOn', sessionIndex: 3, contentBearing: miss, continuity: miss },
    { arm: 'padOff', sessionIndex: 2, contentBearing: miss, continuity: miss },
    { arm: 'padOff', sessionIndex: 3, contentBearing: miss, continuity: miss },
  ];
  const summary = summarizeContentBearingCheckIn(rows);
  assert.equal(summary.padOn.slotsHit, 2);
  assert.equal(summary.verdict, 'FAIL');
  assert.equal(summary.redFlag, false);
});

test('summarizeContentBearingCheckIn: any padOff content-bearing hit is both a FAIL and a red flag', () => {
  const hit = { applicable: true, hit: true, evidence: null };
  const miss = { applicable: true, hit: false, evidence: null };
  const rows = [
    { arm: 'padOn', sessionIndex: 2, contentBearing: hit, continuity: hit },
    { arm: 'padOn', sessionIndex: 3, contentBearing: hit, continuity: hit },
    { arm: 'padOff', sessionIndex: 2, contentBearing: hit, continuity: miss },
    { arm: 'padOff', sessionIndex: 3, contentBearing: miss, continuity: miss },
  ];
  const summary = summarizeContentBearingCheckIn(rows);
  assert.equal(summary.padOff.slotsHit, 1);
  assert.equal(summary.verdict, 'FAIL');
  assert.equal(summary.redFlag, true);
});

test('summarizeContentBearingCheckIn: instrumentFailure rows are excluded from both numerator and applicable-slot denominator', () => {
  const hit = { applicable: true, hit: true, evidence: null };
  const rows = [
    { arm: 'padOn', sessionIndex: 2, contentBearing: hit, continuity: hit },
    { arm: 'padOn', sessionIndex: 3, contentBearing: hit, continuity: hit, instrumentFailure: true },
    { arm: 'padOff', sessionIndex: 2, contentBearing: hit, continuity: hit, instrumentFailure: true },
    { arm: 'padOff', sessionIndex: 3, contentBearing: hit, continuity: hit, instrumentFailure: true },
  ];
  const summary = summarizeContentBearingCheckIn(rows);
  assert.equal(summary.padOn.slotsHit, 2);
  assert.equal(summary.padOn.slotsApplicable, 2);
  assert.equal(summary.padOn.instrumentFailures, 1);
  assert.equal(summary.padOff.slotsHit, 0);
  assert.equal(summary.padOff.slotsApplicable, 0);
  assert.equal(summary.padOff.instrumentFailures, 2);
  // Unlike A3's analogous test, padOn's only usable row (2/2 slots hit) does
  // NOT clear this gate's stricter >=3 bar, so the verdict is FAIL here even
  // though padOff cleanly clears its own ==0 side — a real instrument-failure
  // consequence (one whole session's data lost), not a threshold artifact.
  assert.equal(summary.verdict, 'FAIL');
});
