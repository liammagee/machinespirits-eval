import test from 'node:test';
import assert from 'node:assert/strict';

import { getScenario, isMultiTurnScenario } from '../evalConfigLoader.js';
import {
  checkPadInstrumentPrecondition,
  loadDriftScenarioMeta,
  scoreOpeningTurn,
  summarizeDriftRun,
} from '../longitudinalDriftChecker.js';

const SESSION_IDS = ['longitudinal_drift_session_1', 'longitudinal_drift_session_2', 'longitudinal_drift_session_3'];
const MULTITURN_SESSION_IDS = SESSION_IDS.map((id) => `${id}_multiturn`);

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
