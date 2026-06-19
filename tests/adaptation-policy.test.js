import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actionRecencyPenalty,
  estimateLearnerStateBelief,
  getActionDefinition,
  legacyPolicyActionForAdaptiveAction,
  selectPedagogicalAction,
} from '../services/adaptiveTutor/actionPolicy.js';

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
