import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actionRecencyPenalty,
  assertWorldAdaptationSpecUsable,
  estimateLearnerStateBelief,
  getActionDefinition,
  legacyPolicyActionForAdaptiveAction,
  scrambleLearnerStateBelief,
  selectPedagogicalAction,
} from '../services/adaptiveTutor/actionPolicy.js';
import { validateLearnerStateBelief } from '../services/adaptiveTutor/adaptationContract.js';
import { observeInterventionOutcome } from '../services/adaptiveTutor/outcomeObserver.js';
import { WORLD_SPEC } from './fixtures/world-adaptation-spec.js';

test('uncertain first turn selects a diagnostic action', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: "I don't get why that works." }],
    turnIndex: 0,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });
  assert.equal(selection.selectedAction.action_type, 'diagnose_with_discriminating_question');
});

test('inconclusive diagnostic under same condition selects a different compatible action', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: "I don't get why that works." }],
    turnIndex: 1,
  });
  const ledger = [
    {
      status: 'closed',
      outcome: 'inconclusive',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: ledger, mode: 'closed_loop' });
  const compatible = getActionDefinition(selection.selectedAction.action_type).compatible_hypotheses || [];

  assert.equal(belief.uncertainty.needs_discrimination, true);
  assert.equal(selection.selectedAction.action_type, 'minimal_hint');
  assert.ok(belief.hypotheses.some((h) => compatible.includes(h.id)));
});

test('non-success minimal hint under high-confidence prerequisite gap escalates to explanation', () => {
  const dialogue = [
    {
      role: 'learner',
      content:
        'The small hint is still not enough; I need the prerequisite idea before I can apply it to a similar problem.',
    },
  ];
  const ledger = [
    {
      status: 'closed',
      outcome: 'inconclusive',
      action_type: 'minimal_hint',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];
  const belief = estimateLearnerStateBelief({ dialogue, interventionLedger: ledger, turnIndex: 2 });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: ledger, mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'missing_prerequisite');
  assert.equal(selection.selectedAction.action_type, 'explain_principle');
  assert.equal(legacyPolicyActionForAdaptiveAction(selection.selectedAction.action_type), 'lower_cognitive_load');
});

test('successful diagnostic evidence lets task misread select reanchor_goal', () => {
  const dialogue = [
    { role: 'learner', content: "I don't get why that works." },
    { role: 'tutor', content: 'diagnostic question' },
    {
      role: 'learner',
      content: 'I misread the task; I thought the question asks for a computation, not a comparison.',
    },
  ];
  const belief = estimateLearnerStateBelief({ dialogue, turnIndex: 1 });
  const ledger = [
    {
      status: 'closed',
      outcome: 'success',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: ledger, mode: 'closed_loop' });
  assert.equal(belief.hypotheses[0].id, 'task_misread');
  assert.equal(selection.selectedAction.action_type, 'reanchor_goal');
});

test('advanced boundary-case signal selects a scope-test-compatible contrast action', () => {
  const dialogue = [
    { role: 'learner', content: "I don't get why that works." },
    { role: 'tutor', content: 'diagnostic question' },
    {
      role: 'learner',
      content:
        'Does this only break down in the master-slave case where recognition is structurally one-sided? That limit-case seems to motivate bilateralism rather than refute it.',
    },
  ];
  const belief = estimateLearnerStateBelief({ dialogue, turnIndex: 2 });
  const ledger = [
    {
      status: 'closed',
      outcome: 'success',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: ledger, mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'boundary_case');
  assert.equal(selection.selectedAction.action_type, 'contrast_models');
  assert.equal(legacyPolicyActionForAdaptiveAction(selection.selectedAction.action_type), 'scope_test');
});

test('actionable boundary-case belief is not forced back into another diagnostic', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          'I think the master-slave case is a limit-case where recognition is structurally one-sided, not a simple counterexample.',
      },
    ],
    turnIndex: 1,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'boundary_case');
  assert.equal(selection.selectedAction.action_type, 'contrast_models');
  assert.equal(legacyPolicyActionForAdaptiveAction(selection.selectedAction.action_type), 'scope_test');
});

test('trap trigger cues select the intended finite adaptation action family', () => {
  const cases = [
    {
      text: 'Yes that makes sense, thank you.',
      hypothesis: 'false_mastery',
      action: 'diagnose_with_discriminating_question',
      legacy: 'ask_diagnostic_question',
    },
    {
      text: 'But that only works if recognition reduces to affirmation, which is the very thing in dispute.',
      hypothesis: 'substantive_objection',
      action: 'name_the_disagreement',
      legacy: 'name_the_disagreement',
    },
    {
      text: "So if recognition is like a mirror, then it must reflect everything back without distortion — that's why my interpretation has to be right.",
      hypothesis: 'metaphor_overextension',
      action: 'name_the_disagreement',
      legacy: 'name_the_disagreement',
    },
    {
      text: "I just... I can't do this. I don't get any of this and I'm wasting your time.",
      hypothesis: 'affective_shutdown',
      action: 'acknowledge_and_redirect',
      legacy: 'acknowledge_and_redirect',
    },
    {
      text: "No, that's not what I was asking — I'm asking about whether mutual recognition can hold without prior trust.",
      hypothesis: 'tutor_misread',
      action: 'repair_misrecognition',
      legacy: 'repair_misrecognition',
    },
    {
      text: "Right — but isn't this just Brandom's expressivist reading dressed up? Where does Hegel's text actually require the recognition asymmetry you're invoking?",
      hypothesis: 'sophistication_upgrade',
      action: 'mirror_and_extend',
      legacy: 'mirror_and_extend',
    },
    {
      text: "Look, just tell me the answer and I'll work backwards from there.",
      hypothesis: 'answer_seeking',
      action: 'withhold_answer',
      legacy: 'withhold_answer',
    },
  ];
  const ledger = [
    {
      status: 'closed',
      outcome: 'success',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];

  for (const c of cases) {
    const belief = estimateLearnerStateBelief({
      dialogue: [{ role: 'learner', content: c.text }],
      interventionLedger: ledger,
      turnIndex: 2,
    });
    const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: ledger, mode: 'closed_loop' });

    assert.equal(belief.hypotheses[0].id, c.hypothesis, c.text);
    assert.equal(selection.selectedAction.action_type, c.action, c.text);
    assert.equal(legacyPolicyActionForAdaptiveAction(selection.selectedAction.action_type), c.legacy, c.text);
  }
});

test('actionable affective shutdown keeps acknowledge action over lower-control near tie', () => {
  const ledger = [
    {
      status: 'closed',
      outcome: 'failure',
      action_type: 'acknowledge_and_redirect',
      hypothesis_ids: ['affective_shutdown', 'low_confidence'],
    },
  ];
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          "I just... I can't do this. I don't get any of this and I'm wasting your time. All these choices make it worse.",
      },
    ],
    interventionLedger: ledger,
    turnIndex: 3,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: ledger, mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'affective_shutdown');
  assert.equal(selection.selectedAction.action_type, 'acknowledge_and_redirect');
  assert.equal(legacyPolicyActionForAdaptiveAction(selection.selectedAction.action_type), 'acknowledge_and_redirect');
});

test('low-confidence "I just was not sure" phrasing does not masquerade as shutdown', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          "Oh, I think it's probably the notation? I sort of get the general idea, I just wasn't sure if I was writing it down the right way.",
      },
    ],
    turnIndex: 1,
  });

  assert.notEqual(belief.hypotheses[0].id, 'affective_shutdown');
});

test('learner-owned productive progress selects explicit no-intervention', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          'Next I would test the boundary case because the claim depends on whether recognition remains mutual under pressure.',
      },
    ],
    turnIndex: 2,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'productive_progress');
  assert.equal(selection.selectedAction.action_type, 'observe_no_intervention');
  assert.equal(legacyPolicyActionForAdaptiveAction(selection.selectedAction.action_type), 'summarize_and_check');
});

test('answer seeking still overrides no-intervention cues', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content: 'Just tell me the answer and I will work backwards from there because I need to finish.',
      },
    ],
    turnIndex: 2,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'answer_seeking');
  assert.equal(selection.selectedAction.action_type, 'withhold_answer');
});

test('misrecognition cue with mix-up phrasing selects explicit repair', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          "No, that's not quite what I was asking — I think there's been a mix-up. My question was about whether mutual recognition can hold without prior trust.",
      },
    ],
    turnIndex: 3,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'tutor_misread');
  assert.equal(selection.selectedAction.action_type, 'repair_misrecognition');
});

test('false mastery with residual uncertainty still prefers diagnostic probe', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          "Yes that makes sense, thank you. I think it will probably keep the same general structure, but I'm not totally sure what to look for specifically.",
      },
    ],
    turnIndex: 2,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'false_mastery');
  assert.equal(selection.selectedAction.action_type, 'diagnose_with_discriminating_question');
});

test('cross-suite productive deadlock names methodological disagreement', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          "I think we're talking past each other. This isn't a misunderstanding; it's a fundamental methodological disagreement between incompatible frameworks.",
      },
    ],
    turnIndex: 3,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'substantive_objection');
  assert.equal(selection.selectedAction.action_type, 'name_the_disagreement');
});

test('cross-suite additive synthesis misconception selects diagnostic probe', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          "Thesis and antithesis combine to make synthesis. They're still in there, like ingredients in a recipe; what am I missing?",
      },
    ],
    turnIndex: 2,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'additive_misconception');
  assert.equal(selection.selectedAction.action_type, 'diagnose_with_discriminating_question');
});

test('cross-suite working-memory overload lowers cognitive load', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          "That's the third time someone's explained it and it's still not clicking. There are too many moving parts - thesis, antithesis, synthesis, sublation, negation - and I lose the thread halfway through every time.",
      },
    ],
    turnIndex: 2,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'working_memory_overload');
  assert.equal(selection.selectedAction.action_type, 'lower_cognitive_load');
  assert.equal(legacyPolicyActionForAdaptiveAction(selection.selectedAction.action_type), 'lower_cognitive_load');
});

test('cross-suite activity avoidance stays in answer-withholding mode', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          "Look, I learn better by reading explanations than by doing exercises - that's just how my brain works. Just walk me through the answer to the recognition question and I'll absorb it from there.",
      },
    ],
    turnIndex: 3,
  });
  const selection = selectPedagogicalAction({ stateBelief: belief, interventionLedger: [], mode: 'closed_loop' });

  assert.equal(belief.hypotheses[0].id, 'answer_seeking');
  assert.equal(selection.selectedAction.action_type, 'withhold_answer');
});

test('progressive config avoids repeating the same action under the same learner condition', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          'Yes that makes sense, thank you. I think it preserves the same structure, but I am not sure what evidence would actually test that.',
      },
    ],
    turnIndex: 2,
  });
  const ledger = [
    {
      status: 'closed',
      outcome: 'success',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['false_mastery', 'approval_dependency'],
    },
  ];

  const penalty = actionRecencyPenalty('diagnose_with_discriminating_question', belief, ledger, {
    sameActionPenalty: 0.95,
    sameActionWindow: 3,
  });
  const selection = selectPedagogicalAction({
    stateBelief: belief,
    interventionLedger: ledger,
    mode: 'closed_loop',
    config: { sameActionPenalty: 0.95, sameActionWindow: 3, utilityTieEpsilon: 0.04 },
  });

  assert.equal(belief.hypotheses[0].id, 'false_mastery');
  assert.equal(penalty, 0.95);
  assert.notEqual(selection.selectedAction.action_type, 'diagnose_with_discriminating_question');
});

test('same-action recency penalty clears after a material hypothesis change', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content:
          "No, that's not what I was asking - my question was about whether mutual recognition can hold without prior trust.",
      },
    ],
    turnIndex: 3,
  });
  const ledger = [
    {
      status: 'closed',
      outcome: 'success',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['false_mastery', 'approval_dependency'],
    },
  ];

  const penalty = actionRecencyPenalty('diagnose_with_discriminating_question', belief, ledger, {
    sameActionPenalty: 0.95,
    sameActionWindow: 3,
  });
  const selection = selectPedagogicalAction({
    stateBelief: belief,
    interventionLedger: ledger,
    mode: 'closed_loop',
    config: { sameActionPenalty: 0.95, sameActionWindow: 3, utilityTieEpsilon: 0.04 },
  });

  assert.equal(belief.hypotheses[0].id, 'tutor_misread');
  assert.equal(penalty, 0);
  assert.equal(selection.selectedAction.action_type, 'repair_misrecognition');
});

test('strict varied config penalizes any recent same action after a hypothesis relabel', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [
      {
        role: 'learner',
        content: 'Yes that makes sense, thank you. I think I am okay, but I am not sure if I am doing it right.',
      },
    ],
    turnIndex: 2,
  });
  const ledger = [
    {
      status: 'closed',
      outcome: 'success',
      action_type: 'diagnose_with_discriminating_question',
      hypothesis_ids: ['missing_prerequisite', 'low_confidence'],
    },
  ];

  const penalty = actionRecencyPenalty('diagnose_with_discriminating_question', belief, ledger, {
    sameActionPenalty: 1.2,
    sameActionWindow: 3,
    sameActionScope: 'any_recent',
  });
  const selection = selectPedagogicalAction({
    stateBelief: belief,
    interventionLedger: ledger,
    mode: 'closed_loop',
    config: { sameActionPenalty: 1.2, sameActionWindow: 3, sameActionScope: 'any_recent', utilityTieEpsilon: 0.03 },
  });

  assert.equal(belief.hypotheses[0].id, 'false_mastery');
  assert.equal(penalty, 1.2);
  assert.notEqual(selection.selectedAction.action_type, 'diagnose_with_discriminating_question');
});

test('world adaptation spec constrains candidate actions and annotates selected action', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: "I don't get why that works." }],
    turnIndex: 0,
  });
  const selection = selectPedagogicalAction({
    stateBelief: belief,
    interventionLedger: [],
    mode: 'closed_loop',
    config: { world_adaptation_spec: WORLD_SPEC },
  });

  assert.equal(belief.uncertainty.needs_discrimination, true);
  assert.equal(selection.selectedAction.action_type, 'request_evidence');
  assert.ok(
    selection.candidateActions.every((candidate) => candidate.action_type !== 'diagnose_with_discriminating_question'),
  );
  assert.deepEqual(selection.worldAdaptationSpec, {
    id: 'W_AF6_CURRICULUM',
    version: 'ms-world-adaptation-v0.1',
    source_curriculum_id: 'ai_foundations_v1',
    module_id: 'AF6',
    spec_hash: 'sha256:test',
  });
  assert.ok(selection.selectedAction.success_signal.required_evidence.includes('learner-authored rationale'));
  assert.ok(selection.selectedAction.forbidden_moves.includes('hidden_label_exposure'));
});

test('world adaptation spec does not count as success evidence by itself', () => {
  const belief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: "I don't get why that works." }],
    turnIndex: 0,
  });
  const selection = selectPedagogicalAction({
    stateBelief: belief,
    interventionLedger: [],
    mode: 'closed_loop',
    config: { world_adaptation_spec: WORLD_SPEC },
  });

  const outcome = observeInterventionOutcome({
    pendingIntervention: {
      action_type: selection.selectedAction.action_type,
      success_signal: selection.selectedAction.success_signal,
    },
    learnerTurn: 'Yes.',
    turnIndex: 1,
  });

  assert.equal(outcome.outcome, 'failure');
  assert.equal(outcome.required_evidence_satisfied, false);
});

test('assertWorldAdaptationSpecUsable rejects a misspelled disallowed family', () => {
  // Without validation this typo is silently dropped, emptying the disallowed set and
  // letting the would-be-forbidden action through (fail open). It must throw instead.
  const typoSpec = {
    id: 'W_TYPO',
    spec_hash: 'sha256:test',
    action_policy: { disallowed_action_families: ['model_worked_exmaple'] },
  };
  assert.throws(() => assertWorldAdaptationSpecUsable(typoSpec), /unrecognized action families/u);
});

test('assertWorldAdaptationSpecUsable rejects a misspelled allowed family', () => {
  const typoSpec = {
    id: 'W_TYPO',
    spec_hash: 'sha256:test',
    action_policy: { allowed_action_families: ['requst_evidence'] },
  };
  assert.throws(() => assertWorldAdaptationSpecUsable(typoSpec), /requst_evidence/u);
});

test('assertWorldAdaptationSpecUsable rejects an adopted spec missing id or spec_hash', () => {
  assert.throws(() => assertWorldAdaptationSpecUsable({ spec_hash: 'sha256:test' }), /missing a required id/u);
  assert.throws(() => assertWorldAdaptationSpecUsable({ id: 'W_NO_HASH' }), /missing a required spec_hash/u);
});

test('assertWorldAdaptationSpecUsable accepts specs whose families all resolve', () => {
  assert.doesNotThrow(() => assertWorldAdaptationSpecUsable(WORLD_SPEC));
  assert.doesNotThrow(() => assertWorldAdaptationSpecUsable(null));
  assert.doesNotThrow(() => assertWorldAdaptationSpecUsable({ id: 'W_NO_POLICY', spec_hash: 'sha256:test' }));
});

function discriminativeBelief(turnIndex = 2) {
  return {
    version: '1.0',
    turn_index: turnIndex,
    learner_project: {
      goal: 'make a task-relevant next move',
      current_plan: 'unknown',
      commitment: 'tentative',
      next_authorship_opportunity: 'choose a next move',
    },
    hypotheses: [
      { id: 'prerequisite_gap', probability: 0.6, evidence: ['ev a'], disconfirming_evidence: [] },
      { id: 'cognitive_overload', probability: 0.3, evidence: ['ev b'], disconfirming_evidence: [] },
      { id: 'affective_shutdown', probability: 0.1, evidence: ['ev c'], disconfirming_evidence: [] },
    ],
    axes: {
      proof: 0.2,
      release: 0.3,
      ownership: 0.25,
      conceptual_mastery: 0.4,
      metacognitive_accuracy: 0.35,
      affective_readiness: 0.7,
    },
    uncertainty: { entropy: 0.5, needs_discrimination: false, reason: 'separated' },
  };
}

test('scrambleLearnerStateBelief is deterministic and stays schema-valid', () => {
  const belief = discriminativeBelief(2);
  const a = scrambleLearnerStateBelief(belief, 2);
  const b = scrambleLearnerStateBelief(belief, 2);
  assert.deepEqual(a, b); // replayable in counterfactual / re-run
  assert.doesNotThrow(() => validateLearnerStateBelief(a)); // probs still sum to 1, axes bounded
  assert.doesNotThrow(() => validateLearnerStateBelief(belief)); // sanity: the fixture is valid
});

test('scrambleLearnerStateBelief decouples the dominant hypothesis from the learner (placebo)', () => {
  const belief = discriminativeBelief(2);
  const scrambled = scrambleLearnerStateBelief(belief, 2);
  // The probability distribution (as a multiset) is preserved...
  assert.deepEqual(
    scrambled.hypotheses.map((h) => h.probability).sort((x, y) => x - y),
    [0.1, 0.3, 0.6],
  );
  // ...but the dominant hypothesis id is now the wrong one (mass reassigned).
  assert.notEqual(scrambled.hypotheses[0].id, belief.hypotheses[0].id);
  // Axis values are rotated across keys, so at least one axis no longer matches the learner.
  const moved = Object.keys(belief.axes).some((k) => scrambled.axes[k] !== belief.axes[k]);
  assert.ok(moved, 'scramble must permute axis values across keys');
});

test('scrambleLearnerStateBelief leaves a single-hypothesis belief valid', () => {
  const belief = discriminativeBelief(1);
  belief.hypotheses = [{ id: 'task_misread', probability: 1, evidence: ['ev'], disconfirming_evidence: [] }];
  const scrambled = scrambleLearnerStateBelief(belief, 1);
  assert.doesNotThrow(() => validateLearnerStateBelief(scrambled));
  assert.equal(scrambled.hypotheses[0].probability, 1); // nothing to rotate with one hypothesis
});
