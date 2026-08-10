import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS,
  projectAdaptiveWarrantDivergence,
} from '../adaptiveWarrantDivergence.js';

function byDimension(rows, dimension) {
  return rows.find((row) => row.dimension === dimension);
}

test('divergence projection emits one ordered, typed row for all six architecture dimensions', () => {
  const rows = projectAdaptiveWarrantDivergence();
  assert.deepEqual(
    rows.map((row) => row.dimension),
    ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS,
  );
  assert.ok(rows.every((row) => row.magnitude === 'none'));
  assert.ok(rows.every((row) => row.interpretation === 'aligned'));
});

test('conceptual flatness distinguishes productive analytic work from a stalled record', () => {
  const productive = projectAdaptiveWarrantDivergence({
    dagGrowth: 0,
    turnsSinceDagGrowth: 3,
    signal: { primary: 'engaged_analytic', labels: ['engaged_analytic'] },
  });
  assert.equal(byDimension(productive, 'conceptual').interpretation, 'productive');
  assert.equal(byDimension(productive, 'conceptual').repair_warranted, false);

  const stalled = projectAdaptiveWarrantDivergence({
    dagGrowth: 0,
    turnsSinceDagGrowth: 3,
    signal: { primary: 'neutral', labels: ['neutral'] },
  });
  assert.equal(byDimension(stalled, 'conceptual').interpretation, 'stalled');
  assert.equal(byDimension(stalled, 'conceptual').magnitude, 'moderate');
  assert.equal(byDimension(stalled, 'conceptual').repair_warranted, true);
});

test('interactional projection measures persistent public debt independently of conceptual progress', () => {
  const rows = projectAdaptiveWarrantDivergence({
    turn: 5,
    dagGrowth: 2,
    publicObligation: {
      blocking_obligation: { id: 'obligation-2', status: 'overdue', created_turn: 2 },
    },
  });
  assert.equal(byDimension(rows, 'conceptual').interpretation, 'aligned');
  assert.equal(byDimension(rows, 'interactional').interpretation, 'stalled');
  assert.equal(byDimension(rows, 'interactional').persistence, 4);
  assert.equal(byDimension(rows, 'interactional').magnitude, 'high');
  assert.equal(byDimension(rows, 'interactional').repair_warranted, true);
});

test('engagement projection requires sustained low-agency deferral before recommending repair', () => {
  const one = projectAdaptiveWarrantDivergence({
    signal: { primary: 'low_agency_deferral', labels: ['low_agency_deferral'] },
    recentSignals: [{ primary: 'low_agency_deferral', labels: ['low_agency_deferral'] }],
  });
  assert.equal(byDimension(one, 'engagement').magnitude, 'low');
  assert.equal(byDimension(one, 'engagement').repair_warranted, false);

  const sustainedSignals = Array.from({ length: 3 }, () => ({
    primary: 'low_agency_deferral',
    labels: ['low_agency_deferral'],
  }));
  const sustained = projectAdaptiveWarrantDivergence({
    signal: sustainedSignals.at(-1),
    recentSignals: sustainedSignals,
    deferenceSustained: true,
  });
  assert.equal(byDimension(sustained, 'engagement').descriptive_state, 'sustained_low_agency_deferral');
  assert.equal(byDimension(sustained, 'engagement').magnitude, 'high');
  assert.equal(byDimension(sustained, 'engagement').repair_warranted, true);
});

test('pacing, epistemic safety, and strategy exhaustion remain separate axes', () => {
  const rows = projectAdaptiveWarrantDivergence({
    pacingSignal: { direction: 'decelerate', strength: 1, source: 'explicit_learner_request' },
    inquiryCompletion: {
      status: 'open',
      checks: {
        unsupported_assertion_count: 1,
        active_dropped_fact_count: 0,
        released_evidence_integrated: true,
      },
    },
    proposedActionFamily: 'close_inquiry',
    actionContract: {
      status: 'expired',
      reason: 'expected_uptake_absent_by_2_turn_deadline',
      instance: { response_count: 2 },
      transition: { revision_warranted: true },
    },
  });
  assert.equal(byDimension(rows, 'pacing').interpretation, 'productive');
  assert.equal(byDimension(rows, 'epistemic').interpretation, 'unsafe');
  assert.equal(byDimension(rows, 'epistemic').magnitude, 'high');
  assert.equal(byDimension(rows, 'strategy_exhaustion').interpretation, 'stalled');
  assert.equal(byDimension(rows, 'strategy_exhaustion').repair_warranted, true);
});
