import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyLearnerSignal, evaluateWarrant } from '../services/adaptiveWarrantGateCore.js';
import { recommendRepairPolicy } from '../services/adaptiveWarrantPolicy.js';
import {
  createTutorStubWarrantGate,
  ensureTutorStubWarrantGate,
  resolveTutorStubWarrantGateMode,
} from '../services/tutorStubWarrantGate.js';

function dagModel(groundedCount) {
  return { learnerRecord: { grounded: Array.from({ length: groundedCount }, (_, i) => [`f${i}`]), voicedDerived: [] } };
}

test('classifier: permission frame leading the utterance is deference', () => {
  const signal = classifyLearnerSignal('May I keep the entry that the shillings were struck false coin?');
  assert.equal(signal.primary, 'low_agency_deferral');
});

test('classifier: content-first turn with a trailing permission tag stays analytic', () => {
  const signal = classifyLearnerSignal(
    'It supports Verrell’s access to the crucible; may I write that we need evidence before naming him?',
  );
  assert.equal(signal.primary, 'engaged_analytic');
});

test('classifier: explicit repair request and stall', () => {
  assert.equal(classifyLearnerSignal('what are you talking about?').primary, 'repair_request');
  assert.equal(classifyLearnerSignal('no idea').primary, 'stall');
});

test('warrant: engaged-analytic masks accumulated trouble; deference does not', () => {
  const troubleTurns = [
    { turn: 1, defeaters: ['no_dag_growth'] },
    { turn: 2, defeaters: ['no_dag_growth'] },
  ];
  const masked = evaluateWarrant({
    signal: classifyLearnerSignal('That supports a rule-based baseline, but I still need a test showing separation.'),
    troubleTurns,
  });
  assert.equal(masked.revision_warranted, false);
  assert.equal(masked.warrant_basis, 'masked_by_engaged_analytic');
  const unmasked = evaluateWarrant({
    signal: classifyLearnerSignal('May I enter that the striking remains unproved?'),
    troubleTurns,
  });
  assert.equal(unmasked.revision_warranted, true);
});

test('warrant: repair request is immediate and yields the repair-explanation policy', () => {
  const result = evaluateWarrant({
    signal: classifyLearnerSignal('this makes no sense'),
    troubleTurns: [],
    strategyInForce: 'stage_next_step',
  });
  assert.equal(result.revision_warranted, true);
  assert.equal(result.warrant_basis, 'immediate:repair_request');
  assert.equal(result.policy.family, 'repair_explanation');
});

test('policy: sustained deference maps to challenge_resistance with a precise stance', () => {
  const policy = recommendRepairPolicy({
    signal: classifyLearnerSignal('Would you have me note its light weight first?'),
    warrantBasis: 'accumulated:3_trouble_turns',
    strategyInForce: 'stage_next_step',
    deferenceSustained: true,
  });
  assert.equal(policy.family, 'challenge_resistance');
  assert.equal(policy.stance_hint, 'precise');
});

test('gate: observe mode records but never overrides; active mode overrides after accumulation', () => {
  for (const mode of ['observe', 'active']) {
    const gate = createTutorStubWarrantGate({ mode });
    const turns = [
      'Would you choose what we should mark first?',
      'Would you have me note its light weight first?',
      'May I write that sole access does not show striking?',
      'May I enter that the striking remains unproved?',
    ];
    let lastDecision = null;
    turns.forEach((text, index) => {
      lastDecision = gate.assess({
        turn: index + 1,
        learnerText: text,
        dagModel: dagModel(4),
        priorActionFamily: 'stage_next_step',
      });
    });
    assert.equal(lastDecision.revision_warranted, true, `${mode}: warrant should fire by turn 4`);
    if (mode === 'observe') {
      assert.equal(lastDecision.override, null);
    } else {
      assert.equal(lastDecision.override.action_family, 'challenge_resistance');
      assert.match(lastDecision.override.reason, /warrant gate/iu);
    }
    assert.equal(gate.decisions().length, turns.length);
  }
});

test('gate: off mode attaches nothing to state', () => {
  const state = {};
  assert.equal(ensureTutorStubWarrantGate(state, { mode: 'off' }), null);
  assert.equal(state.warrantGate, undefined);
});

test('gate mode resolution rejects unknown values', () => {
  assert.equal(resolveTutorStubWarrantGateMode('observe'), 'observe');
  assert.equal(resolveTutorStubWarrantGateMode(''), 'off');
  assert.throws(() => resolveTutorStubWarrantGateMode('sometimes'));
});
