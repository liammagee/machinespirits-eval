import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIDACTIC_ACT_FALLBACK_SCHEMA,
  DIDACTIC_MODE_FAMILIES,
  DIDACTIC_MODE_SCHEMA,
  DIDACTIC_OPPORTUNITY_BUDGET_SCHEMA,
  auditDidacticModePublicInput,
  deriveDidacticOpportunityBudget,
  deriveDidacticModeState,
  loadWorld,
  recommendRhetoricalMove,
  runDrama,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SMOKE_WORLD = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));

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
  assert.deepEqual(audit.leaks.map((leak) => leak.key).sort(), ['D', 'corruptionLedger', 'hiddenBoard', 'proofPath']);

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
  assert.equal(state.opportunityCost.schema, DIDACTIC_OPPORTUNITY_BUDGET_SCHEMA);
  assert.equal(state.opportunityCost.maxProofNeutralTurns, 1);
  assert.equal(state.opportunityCost.mayOverrideProofControl, false);
  assert.ok(state.evidence.some((line) => /echo/i.test(line)));
});

test('didactic opportunity budget preserves proof obligation and declares failure action', () => {
  const budget = deriveDidacticOpportunityBudget('decompose_subtask');

  assert.equal(budget.schema, DIDACTIC_OPPORTUNITY_BUDGET_SCHEMA);
  assert.equal(budget.publicOnly, true);
  assert.equal(budget.proofObligationPreserved, true);
  assert.equal(budget.maxProofNeutralTurns, 1);
  assert.match(budget.failureAction, /hidden_proofdebt/u);
});

test('repeated confusion maps to slow_recap', () => {
  const state = deriveDidacticModeState({
    currentObject: 'the crown bed evidence',
    transcript: [
      {
        turn: 4,
        role: 'learner',
        text: 'I am lost on what the crown bed proves.',
        meta: { exchange: { type: 'confusion' } },
      },
      {
        turn: 5,
        role: 'learner',
        text: 'Sorry, I still do not follow the link.',
        meta: { exchange: { type: 'repair_request' } },
      },
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

test('didactic mode biases rhetorical figure and stance while preserving release proof step', () => {
  const didacticMode = deriveDidacticModeState({
    currentObject: 'why the timber-reeve reading matters',
    transcript: [{ turn: 8, role: 'learner', text: 'Why does that evidence matter for the question?' }],
  });
  const advice = recommendRhetoricalMove(
    { id: 'world-didactic-test' },
    { turn: 8, transcript: [], trajectory: [], inference: { frontier: [] } },
    {
      proofStep: { moveFamily: 'release_next_evidence', targetPremise: 'p_brand' },
      releaseCue: true,
      cuePremise: 'p_brand',
      didacticMode,
    },
    { mode: 'deterministic', seed: 1, temperature: 1 },
  );

  assert.equal(advice.didacticMode.recommendedMode, 'purpose_bridge');
  assert.equal(advice.selected.figure, 'analogia');
  assert.equal(advice.selected.intent, 'release');
  assert.equal(advice.selected.targetPremise, 'p_brand');
  assert.equal(advice.selected.stance, 'didactic_purpose_bridge');
  assert.match(advice.selected.rationale, /didactic mode: purpose_bridge; proof intent preserved/u);
});

test('didactic mode preserves repair intent and target under proof debt', () => {
  const didacticMode = deriveDidacticModeState({
    currentObject: 'the crowsfoot mark',
    transcript: [{ turn: 10, role: 'learner', text: 'As you said, the crowsfoot mark is the phrase to keep.' }],
    uptake: { quality: 'echo_only' },
  });
  const advice = recommendRhetoricalMove(
    { id: 'world-didactic-test' },
    { turn: 10, transcript: [], trajectory: [], inference: { frontier: [] } },
    {
      proofStep: { moveFamily: 'repair_dependency', targetPremise: 'p_mark' },
      topProofDebt: { premiseId: 'p_mark' },
      didacticMode,
    },
    { mode: 'deterministic', seed: 1, temperature: 1 },
  );

  assert.equal(advice.didacticMode.recommendedMode, 'teach_back');
  assert.equal(advice.selected.intent, 'restore');
  assert.equal(advice.selected.targetPremise, 'p_mark');
  assert.equal(advice.selected.stance, 'didactic_teach_back');
});

test('act boundary carries public didactic fallback into the next act', async () => {
  const didacticMode = deriveDidacticModeState({
    currentObject: 'the marked falsework chain',
    uptake: { overloaded: true },
    repairSignals: [{ publicObject: 'the marked falsework chain', count: 2, sameObject: true }],
  });
  const tutorViews = [];
  const result = await runDrama({
    world: SMOKE_WORLD,
    roles: {
      director: async (view) =>
        view.turn === 1
          ? { direction: '[The first table is set.]', act: 'continue' }
          : { direction: '[The next act narrows the table.]', act: 'end' },
      tutor: async (view) => {
        tutorViews.push(JSON.parse(JSON.stringify(view)));
        return {
          dialogue: view.turn === 1 ? 'Let us break that chain into one smaller link.' : 'Name the first link only.',
          move: { figure: 'erotema', targetPremise: null, intent: 'consolidate' },
          ...(view.turn === 1 ? { didacticMode } : {}),
        };
      },
      learner: async () => ({ dialogue: 'I am still following only part of it.' }),
    },
    options: {
      acts: { minActTurns: 1, maxActTurns: 3 },
      maxTurns: 2,
      stopOnStall: false,
    },
  });

  assert.equal(result.didacticMode.length, 1);
  assert.equal(result.didacticMode[0].recommendedMode, 'decompose_subtask');
  assert.equal(result.didacticMode[0].opportunityCost.maxProofNeutralTurns, 1);
  assert.equal(result.acts[0].didacticFallback.schema, DIDACTIC_ACT_FALLBACK_SCHEMA);
  assert.equal(result.acts[0].didacticFallback.recommendedMode, 'decompose_subtask');
  assert.equal(result.acts[0].didacticFallback.mayOverrideProofControl, false);
  assert.equal(tutorViews[1].acts.closed[0].didacticFallback.recommendedMode, 'decompose_subtask');
});
