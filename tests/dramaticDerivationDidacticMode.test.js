import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIDACTIC_MODE_FAMILIES,
  DIDACTIC_MODE_SCHEMA,
  auditDidacticModePublicInput,
  deriveDidacticModeState,
} from '../services/dramaticDerivation/index.js';

test('didactic mode exposes exactly the compact initial mode family set', () => {
  assert.deepEqual([...DIDACTIC_MODE_FAMILIES].sort(), [
    'analogy_bridge',
    'concrete_example',
    'contrast_case',
    'decompose_subtask',
    'purpose_bridge',
    'repair_vocabulary',
    'slow_recap',
    'teach_back',
  ]);
});

test('didactic mode audit rejects forbidden proof-state inputs recursively', () => {
  const audit = auditDidacticModePublicInput({
    transcript: [{ role: 'learner', text: 'I am lost.' }],
    proofPath: ['p1', 'p2'],
    learnerState: {
      hiddenBoard: [['signedBy', 'pass', 'clerk']],
      nested: { D: 3, corruptionLedger: [{ premiseId: 'p1' }] },
    },
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.leaks.map((leak) => leak.key).sort(),
    ['D', 'corruptionLedger', 'hiddenBoard', 'proofPath'],
  );

  const state = deriveDidacticModeState({
    currentObject: 'the public exhibit',
    proofPath: ['p1', 'p2'],
  });
  assert.equal(state.schema, DIDACTIC_MODE_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.mayOverrideProofControl, false);
  assert.equal(state.inputAudit.ok, false);
  assert.equal(state.learningSignal, 'unknown');
  assert.equal(state.recommendedMode, 'slow_recap');
  assert.match(JSON.stringify(state), /input rejected/u);
  assert.doesNotMatch(JSON.stringify(state), /p1|p2/u);
});

test('echo without ownership maps to teach_back', () => {
  const state = deriveDidacticModeState({
    currentObject: 'the crowsfoot mark',
    transcript: [{ turn: 7, role: 'learner', text: 'As you said, the crowsfoot mark is the phrase to keep.' }],
    uptake: { quality: 'echo_only', ownsCurrentObject: false },
  });

  assert.equal(state.learningSignal, 'echo_only');
  assert.equal(state.recommendedMode, 'teach_back');
  assert.equal(state.scope, 'scene');
  assert.match(state.exitCondition, /own words/u);
  assert.ok(state.evidence.some((line) => /echo/i.test(line)));
});

test('repeated confusion maps to slow_recap', () => {
  const state = deriveDidacticModeState({
    currentObject: 'the crown bed evidence',
    transcript: [
      { turn: 4, role: 'learner', text: 'I am lost on what the crown bed proves.', meta: { exchange: { type: 'confusion' } } },
      { turn: 5, role: 'learner', text: 'Sorry, I still do not follow the link.', meta: { exchange: { type: 'repair_request' } } },
    ],
    scene: { closeStatus: 'needs_repair' },
  });

  assert.equal(state.learningSignal, 'stalled');
  assert.equal(state.recommendedMode, 'slow_recap');
  assert.match(state.exitCondition, /next missing link/u);
});

test('purpose question maps to purpose_bridge', () => {
  const state = deriveDidacticModeState({
    currentObject: 'the timber-reeve reading',
    transcript: [{ turn: 8, role: 'learner', text: 'Why does that evidence matter for the question?' }],
  });

  assert.equal(state.learningSignal, 'purpose_gap');
  assert.equal(state.recommendedMode, 'purpose_bridge');
  assert.match(state.exitCondition, /connects the evidence/u);
});

test('wrong nearby route maps to contrast_case', () => {
  const state = deriveDidacticModeState({
    currentObject: 'the distinction between liability and causation',
    exchange: { type: 'misapplied_route' },
    uptake: { wrongRoute: true, nearbyAlternative: 'liability instead of causation' },
  });

  assert.equal(state.learningSignal, 'misapplied');
  assert.equal(state.recommendedMode, 'contrast_case');
  assert.match(state.exitCondition, /distinguishes/u);
});

test('abstract rule not landing maps to concrete_example', () => {
  const state = deriveDidacticModeState({
    currentObject: 'exclusive source of a mark',
    uptake: { abstractRuleNotLanding: true },
    discursiveCalibration: { publicPosture: 'tentative_correct', uptakeQuality: 'thin' },
  });

  assert.equal(state.learningSignal, 'stalled');
  assert.equal(state.recommendedMode, 'concrete_example');
  assert.match(state.exitCondition, /maps the example/u);
});

test('transfer need maps to analogy_bridge', () => {
  const state = deriveDidacticModeState({
    currentObject: 'the prop-mark as a trace',
    uptake: { needsTransfer: true },
    learnerState: { asksForParallel: true },
  });

  assert.equal(state.learningSignal, 'stalled');
  assert.equal(state.recommendedMode, 'analogy_bridge');
  assert.match(state.exitCondition, /shared structure/u);
});

test('overload and repeated same-object repairs map to decompose_subtask', () => {
  const state = deriveDidacticModeState({
    currentObject: 'the marked falsework chain',
    uptake: { overloaded: true },
    repairSignals: [{ publicObject: 'the marked falsework chain', count: 2, sameObject: true }],
    act: { audit: { outcome: 'fallback_failed' } },
  });

  assert.equal(state.learningSignal, 'overloaded');
  assert.equal(state.recommendedMode, 'decompose_subtask');
  assert.equal(state.scope, 'next_act');
  assert.match(state.exitCondition, /subtask/u);
  assert.equal(state.nonLeakAudit.ok, true);
  assert.deepEqual(state.nonLeakAudit.leaks, []);
});

test('vocabulary or context confusion maps to repair_vocabulary', () => {
  const state = deriveDidacticModeState({
    currentObject: 'what surety means in this scene',
    transcript: [{ turn: 4, role: 'learner', text: 'Sorry, what does surety mean here?' }],
    uptake: { vocabularyConfusion: true },
  });

  assert.equal(state.learningSignal, 'stalled');
  assert.equal(state.recommendedMode, 'repair_vocabulary');
  assert.match(state.exitCondition, /uses the term/u);
});
