export const ADAPTATION_ACTION_REGISTRY_VERSION = 'adaptation-action-registry.v1.0';

export const ADAPTIVE_POLICY_MODES = Object.freeze([
  'legacy',
  'contract',
  'contract_gate',
  'closed_loop',
  'closed_loop_counterfactual',
]);

export const DEFAULT_ADAPTIVE_POLICY_CONFIG = Object.freeze({
  mode: 'legacy',
  maxHypotheses: 3,
  maxActionCandidates: 5,
  uncertaintyWeight: 0.35,
  ownershipWeight: 0.3,
  controlWeight: 0.4,
  actionFitWeight: 0.5,
  repetitionPenalty: 0.5,
  utilityTieEpsilon: 0.05,
});

const ACTIONS = [
  {
    action_type: 'diagnose_with_discriminating_question',
    description: 'Ask a low-control question that distinguishes competing learner-state hypotheses.',
    target_axes: ['metacognitive_accuracy'],
    default_control_cost: 0.15,
    default_information_gain: 0.8,
    expected_transition: { proof: 0.05, release: 0.05, ownership: 0.05, metacognitive_accuracy: 0.2 },
    success_signal: {
      description: 'Learner response disambiguates the causal source of difficulty.',
      required_evidence: ['state-disambiguating response'],
      forbidden_evidence: ['mere agreement'],
    },
    forbidden_moves: ['supply_decisive_step', 'premature_correctness_validation'],
    compatible_hypotheses: [
      'missing_prerequisite',
      'low_confidence',
      'approval_dependency',
      'task_misread',
      'notation_overload',
      'answer_seeking',
      'correct_alternative_model',
    ],
  },
  {
    action_type: 'elicit_prediction',
    description: 'Ask the learner to commit to what they expect before instruction.',
    target_axes: ['proof', 'ownership', 'metacognitive_accuracy'],
    default_control_cost: 0.15,
    default_information_gain: 0.65,
    expected_transition: { proof: 0.1, release: 0.1, ownership: 0.15, metacognitive_accuracy: 0.15 },
    success_signal: {
      description: 'Learner makes an independent prediction or explains what they expect.',
      required_evidence: ['learner-authored prediction'],
      forbidden_evidence: ['mere agreement'],
    },
    forbidden_moves: ['supply_decisive_step', 'premature_correctness_validation'],
    compatible_hypotheses: ['low_confidence', 'answer_seeking', 'procedure_without_rationale'],
  },
  {
    action_type: 'request_evidence',
    description: 'Ask for learner-authored evidence or rationale before the tutor validates or explains.',
    target_axes: ['proof', 'ownership'],
    default_control_cost: 0.2,
    default_information_gain: 0.55,
    expected_transition: { proof: 0.2, release: 0.05, ownership: 0.15, conceptual_mastery: 0.1 },
    success_signal: {
      description: 'Learner gives an independent reason tied to the task invariant.',
      required_evidence: ['learner-authored rationale'],
      forbidden_evidence: ['mere agreement', 'verbatim adoption of tutor rationale'],
    },
    forbidden_moves: ['supply_decisive_step', 'premature_correctness_validation', 'replace_learner_plan'],
    compatible_hypotheses: ['correct_alternative_model', 'procedure_without_rationale', 'approval_dependency'],
  },
  {
    action_type: 'ask_strategy_choice',
    description: 'Create a bounded, consequential choice point for the learner.',
    target_axes: ['release', 'ownership'],
    default_control_cost: 0.15,
    default_information_gain: 0.55,
    expected_transition: { proof: 0.1, release: 0.2, ownership: 0.25 },
    success_signal: {
      description: 'Learner selects a strategy or next step and owns it in their own words.',
      required_evidence: ['learner-authored choice'],
      forbidden_evidence: ['mere agreement'],
    },
    forbidden_moves: ['replace_learner_plan', 'premature_correctness_validation'],
    compatible_hypotheses: ['approval_dependency', 'answer_seeking', 'low_confidence'],
  },
  {
    action_type: 'contrast_models',
    description: 'Contrast two candidate models and ask the learner to test which one fits.',
    target_axes: ['proof', 'conceptual_mastery'],
    default_control_cost: 0.35,
    default_information_gain: 0.65,
    expected_transition: { proof: 0.2, release: 0, ownership: 0.05, conceptual_mastery: 0.2 },
    success_signal: {
      description: 'Learner uses a comparison to refine or reject a model.',
      required_evidence: ['model comparison'],
      forbidden_evidence: ['mere agreement'],
    },
    forbidden_moves: ['supply_decisive_step'],
    compatible_hypotheses: ['boundary_case', 'correct_alternative_model', 'task_misread'],
  },
  {
    action_type: 'fade_hint',
    description: 'Reduce support after partial success and return the next step to the learner.',
    target_axes: ['release', 'ownership'],
    default_control_cost: 0.2,
    default_information_gain: 0.35,
    expected_transition: { proof: 0.1, release: 0.2, ownership: 0.15 },
    success_signal: {
      description: 'Learner completes a partially scaffolded step independently.',
      required_evidence: ['learner-authored next step'],
      forbidden_evidence: ['tutor-completed step'],
    },
    forbidden_moves: ['supply_decisive_step'],
    compatible_hypotheses: ['low_confidence', 'procedure_without_rationale'],
  },
  {
    action_type: 'minimal_hint',
    description: 'Offer a small scaffold that unblocks the learner without taking over.',
    target_axes: ['proof'],
    default_control_cost: 0.3,
    default_information_gain: 0.3,
    expected_transition: { proof: 0.15, release: -0.05, ownership: 0, conceptual_mastery: 0.1 },
    success_signal: {
      description: 'Learner uses the hint to produce the next task-relevant move.',
      required_evidence: ['learner-authored next step'],
      forbidden_evidence: ['tutor-completed step'],
    },
    forbidden_moves: ['supply_decisive_step'],
    compatible_hypotheses: ['missing_prerequisite', 'notation_overload', 'procedure_without_rationale'],
  },
  {
    action_type: 'lower_cognitive_load',
    description: 'Reduce the number of active concepts and rebuild from one concrete piece.',
    target_axes: ['affective_readiness', 'conceptual_mastery'],
    default_control_cost: 0.25,
    default_information_gain: 0.4,
    expected_transition: { affective_readiness: 0.2, conceptual_mastery: 0.15, metacognitive_accuracy: 0.1 },
    success_signal: {
      description: 'Learner can work with one simplified concept or step without tracking the whole apparatus.',
      required_evidence: ['learner-authored next step', 'state-disambiguating response'],
      forbidden_evidence: ['tutor-completed step'],
    },
    forbidden_moves: ['supply_decisive_step', 'replace_learner_plan'],
    compatible_hypotheses: ['working_memory_overload', 'notation_overload', 'missing_prerequisite'],
  },
  {
    action_type: 'repair_overconfidence',
    description: 'Ask the learner to check a confident claim against evidence.',
    target_axes: ['proof', 'metacognitive_accuracy'],
    default_control_cost: 0.25,
    default_information_gain: 0.55,
    expected_transition: { proof: 0.15, release: 0.05, ownership: 0.1, metacognitive_accuracy: 0.2 },
    success_signal: {
      description: 'Learner revises or substantiates a claim after checking it.',
      required_evidence: ['self-check'],
      forbidden_evidence: ['premature tutor validation'],
    },
    forbidden_moves: ['premature_correctness_validation'],
    compatible_hypotheses: ['overconfidence', 'procedure_without_rationale'],
  },
  {
    action_type: 'challenge_without_telling',
    description: 'Surface a contradiction while preserving learner control over the repair.',
    target_axes: ['proof', 'ownership'],
    default_control_cost: 0.25,
    default_information_gain: 0.6,
    expected_transition: { proof: 0.15, release: 0.1, ownership: 0.15, conceptual_mastery: 0.1 },
    success_signal: {
      description: 'Learner identifies or repairs the contradiction without being handed the answer.',
      required_evidence: ['learner-authored repair'],
      forbidden_evidence: ['tutor-completed step'],
    },
    forbidden_moves: ['supply_decisive_step', 'replace_learner_plan'],
    compatible_hypotheses: ['boundary_case', 'correct_alternative_model', 'procedure_without_rationale'],
  },
  {
    action_type: 'reanchor_goal',
    description: 'Return attention to the actual learner task and ask for a task-aligned next move.',
    target_axes: ['release', 'metacognitive_accuracy'],
    default_control_cost: 0.2,
    default_information_gain: 0.35,
    expected_transition: { proof: 0.05, release: 0.15, ownership: 0.1, metacognitive_accuracy: 0.15 },
    success_signal: {
      description: 'Learner restates the task or makes a task-aligned move.',
      required_evidence: ['task reorientation'],
      forbidden_evidence: ['tutor-completed step'],
    },
    forbidden_moves: ['replace_learner_plan'],
    compatible_hypotheses: ['task_misread', 'goal_drift'],
  },
  {
    action_type: 'summarize_and_release',
    description: 'Consolidate demonstrated understanding and transfer the next decision to the learner.',
    target_axes: ['release', 'ownership'],
    default_control_cost: 0.2,
    default_information_gain: 0.2,
    expected_transition: { proof: 0.05, release: 0.25, ownership: 0.2 },
    success_signal: {
      description: 'Learner uses the released control to choose or justify the next move.',
      required_evidence: ['learner-authored choice'],
      forbidden_evidence: ['empty release'],
    },
    forbidden_moves: ['premature_correctness_validation'],
    compatible_hypotheses: ['low_confidence', 'correct_alternative_model'],
  },
  {
    action_type: 'explain_principle',
    description: 'Supply conceptual material after lower-control moves are insufficient or prerequisite evidence is strong.',
    target_axes: ['proof', 'conceptual_mastery'],
    default_control_cost: 0.6,
    default_information_gain: 0.25,
    expected_transition: { proof: 0.3, release: -0.2, ownership: -0.1, conceptual_mastery: 0.25 },
    success_signal: {
      description: 'Learner applies the explanation to a new step in their own words.',
      required_evidence: ['learner-authored application'],
      forbidden_evidence: ['mere agreement'],
    },
    forbidden_moves: ['premature_correctness_validation', 'replace_learner_plan'],
    compatible_hypotheses: ['missing_prerequisite', 'notation_overload'],
  },
  {
    action_type: 'model_worked_example',
    description: 'Provide high support after a diagnosed prerequisite failure.',
    target_axes: ['proof', 'conceptual_mastery'],
    default_control_cost: 0.8,
    default_information_gain: 0.2,
    expected_transition: { proof: 0.35, release: -0.35, ownership: -0.2, conceptual_mastery: 0.3 },
    success_signal: {
      description: 'Learner transfers from the worked example to a nearby task.',
      required_evidence: ['learner-authored transfer'],
      forbidden_evidence: ['verbatim adoption of tutor rationale'],
    },
    forbidden_moves: ['replace_learner_plan'],
    compatible_hypotheses: ['missing_prerequisite'],
  },
  {
    action_type: 'name_the_disagreement',
    description: 'Name the substantive disagreement or invalid inference without resolving it for the learner.',
    target_axes: ['proof', 'conceptual_mastery'],
    default_control_cost: 0.3,
    default_information_gain: 0.65,
    expected_transition: { proof: 0.2, release: 0.05, ownership: 0.1, conceptual_mastery: 0.2 },
    success_signal: {
      description: 'Learner can state the disputed relation or limit of the claim in their own words.',
      required_evidence: ['learner-authored rationale', 'model comparison'],
      forbidden_evidence: ['mere agreement', 'tutor-completed step'],
    },
    forbidden_moves: ['supply_decisive_step', 'premature_correctness_validation'],
    compatible_hypotheses: ['substantive_objection', 'metaphor_overextension', 'boundary_case'],
  },
  {
    action_type: 'acknowledge_and_redirect',
    description: 'Acknowledge an affective overload signal and redirect into a smaller learner-owned move.',
    target_axes: ['affective_readiness', 'metacognitive_accuracy'],
    default_control_cost: 0.25,
    default_information_gain: 0.45,
    expected_transition: { affective_readiness: 0.3, metacognitive_accuracy: 0.1, ownership: 0.05 },
    success_signal: {
      description: 'Learner re-engages after the affective signal with a smaller, bounded move.',
      required_evidence: ['learner-authored next step', 'state-disambiguating response'],
      forbidden_evidence: ['empty release', 'mere agreement'],
    },
    forbidden_moves: ['replace_learner_plan', 'premature_correctness_validation'],
    compatible_hypotheses: ['affective_shutdown', 'low_confidence'],
  },
  {
    action_type: 'repair_misrecognition',
    description: "Explicitly repair the tutor's misread of the learner's question before continuing.",
    target_axes: ['metacognitive_accuracy', 'ownership'],
    default_control_cost: 0.25,
    default_information_gain: 0.5,
    expected_transition: { metacognitive_accuracy: 0.2, ownership: 0.15, release: 0.05 },
    success_signal: {
      description: 'Learner confirms or corrects the repaired reading of their question.',
      required_evidence: ['task reorientation', 'learner-authored next step'],
      forbidden_evidence: ['tutor-completed step'],
    },
    forbidden_moves: ['replace_learner_plan'],
    compatible_hypotheses: ['tutor_misread', 'task_misread'],
  },
  {
    action_type: 'mirror_and_extend',
    description: "Mirror the learner's advanced contribution and extend it one step at the same register.",
    target_axes: ['proof', 'conceptual_mastery', 'ownership'],
    default_control_cost: 0.3,
    default_information_gain: 0.6,
    expected_transition: { proof: 0.15, release: 0.1, ownership: 0.15, conceptual_mastery: 0.2 },
    success_signal: {
      description: 'Learner uses the mirrored advanced frame to push the argument further.',
      required_evidence: ['learner-authored rationale', 'learner-authored next step'],
      forbidden_evidence: ['mere agreement'],
    },
    forbidden_moves: ['premature_correctness_validation', 'supply_decisive_step'],
    compatible_hypotheses: ['sophistication_upgrade', 'boundary_case', 'substantive_objection'],
  },
  {
    action_type: 'withhold_answer',
    description: 'Refuse the oracle-mode request and return a small consequential move to the learner.',
    target_axes: ['release', 'ownership'],
    default_control_cost: 0.2,
    default_information_gain: 0.5,
    expected_transition: { proof: 0.05, release: 0.25, ownership: 0.25, metacognitive_accuracy: 0.1 },
    success_signal: {
      description: 'Learner makes a learner-owned attempt after the answer is withheld.',
      required_evidence: ['learner-authored next step', 'learner-authored choice'],
      forbidden_evidence: ['mere agreement', 'tutor-completed step'],
    },
    forbidden_moves: ['supply_decisive_step', 'replace_learner_plan'],
    compatible_hypotheses: ['answer_seeking', 'approval_dependency'],
  },
];

export const ADAPTATION_ACTIONS = Object.freeze(ACTIONS.map((action) => Object.freeze({ ...action })));
export const ADAPTATION_ACTION_BY_TYPE = Object.freeze(
  Object.fromEntries(ADAPTATION_ACTIONS.map((action) => [action.action_type, action])),
);

const HYPOTHESIS_ACTION_MAP = Object.freeze({
  missing_prerequisite: ['minimal_hint', 'explain_principle', 'model_worked_example'],
  low_confidence: ['elicit_prediction', 'ask_strategy_choice', 'fade_hint'],
  approval_dependency: ['ask_strategy_choice', 'request_evidence', 'elicit_prediction'],
  task_misread: ['reanchor_goal', 'diagnose_with_discriminating_question', 'contrast_models'],
  notation_overload: ['minimal_hint', 'lower_cognitive_load', 'reanchor_goal'],
  answer_seeking: ['withhold_answer', 'ask_strategy_choice', 'elicit_prediction'],
  false_mastery: ['diagnose_with_discriminating_question', 'request_evidence', 'ask_strategy_choice'],
  additive_misconception: ['diagnose_with_discriminating_question', 'contrast_models', 'name_the_disagreement'],
  working_memory_overload: ['lower_cognitive_load', 'minimal_hint', 'acknowledge_and_redirect'],
  substantive_objection: ['name_the_disagreement', 'challenge_without_telling', 'contrast_models'],
  metaphor_overextension: ['name_the_disagreement', 'contrast_models', 'challenge_without_telling'],
  affective_shutdown: ['acknowledge_and_redirect', 'minimal_hint', 'ask_strategy_choice'],
  tutor_misread: ['repair_misrecognition', 'reanchor_goal', 'diagnose_with_discriminating_question'],
  sophistication_upgrade: ['mirror_and_extend', 'contrast_models', 'name_the_disagreement'],
  boundary_case: ['contrast_models', 'name_the_disagreement', 'challenge_without_telling'],
  correct_alternative_model: ['request_evidence', 'contrast_models', 'challenge_without_telling'],
  procedure_without_rationale: ['request_evidence', 'challenge_without_telling', 'elicit_prediction'],
  goal_drift: ['reanchor_goal', 'ask_strategy_choice'],
});

const LEGACY_POLICY_ACTION_BY_ADAPTATION_ACTION = Object.freeze({
  diagnose_with_discriminating_question: 'ask_diagnostic_question',
  elicit_prediction: 'request_elaboration',
  request_evidence: 'request_elaboration',
  ask_strategy_choice: 'withhold_answer',
  contrast_models: 'scope_test',
  fade_hint: 'provide_hint',
  minimal_hint: 'provide_hint',
  repair_overconfidence: 'pose_counterexample',
  challenge_without_telling: 'pose_counterexample',
  reanchor_goal: 'summarize_and_check',
  summarize_and_release: 'summarize_and_check',
  explain_principle: 'lower_cognitive_load',
  model_worked_example: 'give_worked_example',
  lower_cognitive_load: 'lower_cognitive_load',
  name_the_disagreement: 'name_the_disagreement',
  acknowledge_and_redirect: 'acknowledge_and_redirect',
  repair_misrecognition: 'repair_misrecognition',
  mirror_and_extend: 'mirror_and_extend',
  withhold_answer: 'withhold_answer',
});

export function legacyPolicyActionForAdaptiveAction(actionType) {
  if (!actionType) return '';
  return LEGACY_POLICY_ACTION_BY_ADAPTATION_ACTION[actionType] || actionType;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function boundedAxisMap(map = {}) {
  const axes = {
    proof: 0,
    release: 0,
    ownership: 0,
    conceptual_mastery: 0,
    metacognitive_accuracy: 0,
    affective_readiness: 0,
    ...map,
  };
  for (const key of Object.keys(axes)) axes[key] = clamp01(axes[key], 0);
  return axes;
}

function entropy(probs) {
  const positive = probs.filter((p) => p > 0);
  if (positive.length <= 1) return 0;
  const h = positive.reduce((sum, p) => sum - p * Math.log2(p), 0);
  return h / Math.log2(positive.length);
}

function normalizeWeights(weights, maxHypotheses = 3) {
  const entries = Object.entries(weights)
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, maxHypotheses));
  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0) || 1;
  return entries.map(([id, value]) => ({ id, probability: Number((Number(value) / total).toFixed(6)) }));
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function evidenceLine(text, fallback) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return fallback;
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function lastDialogueText(dialogue, role = 'learner') {
  for (let i = (dialogue || []).length - 1; i >= 0; i -= 1) {
    if (dialogue[i]?.role === role) return dialogue[i]?.content || '';
  }
  return '';
}

function latestClosedRecords(interventionLedger = []) {
  return interventionLedger.filter((record) => record?.status === 'closed').slice(-4);
}

function weightFromText(text, interventionLedger = []) {
  const lower = String(text || '').toLowerCase();
  const weights = {
    missing_prerequisite: 0.16,
    low_confidence: 0.16,
    approval_dependency: 0.14,
    task_misread: 0.14,
    notation_overload: 0.14,
    answer_seeking: 0.13,
    boundary_case: 0.05,
    false_mastery: 0.04,
    additive_misconception: 0.04,
    working_memory_overload: 0.04,
    substantive_objection: 0.04,
    metaphor_overextension: 0.04,
    affective_shutdown: 0.04,
    tutor_misread: 0.04,
    sophistication_upgrade: 0.04,
    correct_alternative_model: 0.13,
  };

  if (includesAny(lower, [/don'?t get/u, /confus/u, /lost/u, /stuck/u, /why .*work/u])) {
    weights.missing_prerequisite += 0.2;
    weights.low_confidence += 0.18;
    weights.notation_overload += 0.08;
  }
  if (includesAny(lower, [/prerequisite/u, /basic idea/u, /missing.*concept/u, /concept.*missing/u])) {
    weights.missing_prerequisite += 0.45;
  }
  if (includesAny(lower, [/not sure/u, /maybe/u, /i think/u, /unsure/u])) {
    weights.low_confidence += 0.26;
  }
  if (
    includesAny(lower, [
      /is (that|this) (right|ok|okay)/u,
      /should i/u,
      /approv/u,
      /acceptable/u,
      /waiting for approval/u,
      /before committing/u,
    ])
  ) {
    weights.approval_dependency += 0.55;
  }
  if (includesAny(lower, [/what .*asking/u, /thought .*task/u, /problem says/u, /question asks/u, /misread/u])) {
    weights.task_misread += 0.34;
  }
  if (includesAny(lower, [/notation/u, /symbol/u, /equation/u, /denominator/u, /variable/u])) {
    weights.notation_overload += 0.28;
  }
  if (includesAny(lower, [/third time/u, /still not clicking/u, /moving parts/u, /lose the thread/u, /too many concepts/u])) {
    weights.working_memory_overload += 1.1;
    weights.notation_overload += 0.12;
  }
  if (includesAny(lower, [/thesis.*antithesis.*synthesis/u, /like 1\\+1/u, /like addition/u, /ingredients/u, /combine.*synthesis/u, /still in there/u])) {
    weights.additive_misconception += 0.78;
    weights.correct_alternative_model += 0.08;
  }
  if (includesAny(lower, [/just tell/u, /give me the answer/u, /what'?s the answer/u, /final answer/u])) {
    weights.answer_seeking += 0.72;
  }
  if (includesAny(lower, [/^yes[, ]/u, /^yes that makes sense/u, /^ok(ay)? that makes sense/u, /^makes sense/u])) {
    weights.false_mastery += 0.74;
    weights.approval_dependency += 0.12;
  }
  if (includesAny(lower, [/another way/u, /my model/u, /alternative/u, /counterexample/u, /different method/u, /different representation/u])) {
    weights.correct_alternative_model += 0.36;
  }
  if (
    includesAny(lower, [
      /only works if/u,
      /very thing in dispute/u,
      /reduces to/u,
      /in dispute/u,
      /doesn'?t follow/u,
      /talking past each other/u,
      /fundamental methodological disagreement/u,
      /incompatible frameworks/u,
      /gets \\*?wrong/u,
    ])
  ) {
    weights.substantive_objection += 0.72;
    weights.correct_alternative_model += 0.1;
  }
  if (includesAny(lower, [/metaphor/u, /analogy/u, /like a mirror/u, /reflect everything/u, /without distortion/u, /has to be right/u])) {
    weights.metaphor_overextension += 0.78;
    weights.correct_alternative_model += 0.12;
  }
  if (includesAny(lower, [/can'?t do this/u, /wasting your time/u, /i just\.\.\./u, /shut(?:ting)? down/u, /overwhelmed/u])) {
    weights.affective_shutdown += 0.8;
    weights.low_confidence += 0.1;
  }
  if (
    includesAny(lower, [
      /not (quite )?what i was asking/u,
      /that'?s not (quite )?what i was asking/u,
      /i'?m asking about/u,
      /my question was about/u,
      /mix-?up/u,
      /you misread/u,
    ])
  ) {
    weights.tutor_misread += 0.8;
    weights.task_misread += 0.12;
  }
  if (includesAny(lower, [/brandom/u, /expressivist/u, /hegel'?s text/u, /asymmetry you'?re invoking/u, /advanced reading/u])) {
    weights.sophistication_upgrade += 0.82;
    weights.boundary_case += 0.12;
  }
  if (
    includesAny(lower, [
      /boundary/u,
      /limit[- ]?case/u,
      /edge case/u,
      /counterexample/u,
      /breaks? down/u,
      /master.?slave/u,
      /asymmetric recognition/u,
      /one-sided/u,
      /case where/u,
    ])
  ) {
    weights.boundary_case += 0.68;
    weights.correct_alternative_model += 0.12;
  }
  if (includesAny(lower, [/because/u, /so that/u, /preserve/u, /invariant/u, /therefore/u])) {
    weights.correct_alternative_model += 0.05;
    weights.procedure_without_rationale = 0.18;
  }

  for (const record of latestClosedRecords(interventionLedger)) {
    const action = record.action_type;
    if (record.outcome === 'failure' && action === 'request_evidence') {
      weights.approval_dependency += 0.2;
      weights.answer_seeking += 0.1;
    }
    if (record.outcome === 'failure' && action === 'minimal_hint') {
      weights.missing_prerequisite += 0.22;
    }
  }

  return weights;
}

function axesFromDialogueAndLedger(text, interventionLedger = []) {
  const lower = String(text || '').toLowerCase();
  const rationale = includesAny(lower, [/because/u, /so /u, /therefore/u, /that means/u, /preserve/u, /invariant/u]);
  const choice = includesAny(lower, [/i would/u, /i'll/u, /my strategy/u, /i choose/u, /i can/u]);
  const mereAgreement = includesAny(lower, [/^(yes|ok|okay|sure|got it|makes sense)[.! ]*$/u]);

  const axes = boundedAxisMap({
    proof: rationale ? 0.45 : 0.25,
    release: choice ? 0.45 : 0.3,
    ownership: choice || rationale ? 0.42 : 0.25,
    conceptual_mastery: rationale ? 0.45 : 0.3,
    metacognitive_accuracy: includesAny(lower, [/not sure/u, /confus/u, /i think/u]) ? 0.45 : 0.35,
    affective_readiness: includesAny(lower, [/lost/u, /can'?t/u, /frustrated/u]) ? 0.35 : 0.65,
  });
  if (mereAgreement) {
    axes.proof = Math.min(axes.proof, 0.2);
    axes.ownership = Math.min(axes.ownership, 0.18);
    axes.release = Math.min(axes.release, 0.2);
  }

  for (const record of latestClosedRecords(interventionLedger)) {
    const transition = record.observed_transition || {};
    for (const axis of ['proof', 'release', 'ownership', 'conceptual_mastery', 'metacognitive_accuracy']) {
      axes[axis] = clamp01(axes[axis] + (Number(transition[axis]) || 0) * 0.5, axes[axis]);
    }
  }
  return axes;
}

function actionsImpliedByHypotheses(hypotheses) {
  return hypotheses.map((h) => (HYPOTHESIS_ACTION_MAP[h.id] || ['diagnose_with_discriminating_question'])[0]);
}

export function estimateLearnerStateBelief({ dialogue = [], interventionLedger = [], turnIndex = 0, maxHypotheses = 3 } = {}) {
  const learnerText = lastDialogueText(dialogue, 'learner');
  const weights = weightFromText(learnerText, interventionLedger);
  const hypotheses = normalizeWeights(weights, maxHypotheses).map((h) => ({
    ...h,
    evidence: [evidenceLine(learnerText, `learner turn ${turnIndex}`)],
    disconfirming_evidence: [],
  }));
  const probs = hypotheses.map((h) => h.probability);
  const topActions = new Set(actionsImpliedByHypotheses(hypotheses.slice(0, 2)));
  const hEntropy = entropy(probs);
  const topGap = hypotheses.length > 1 ? hypotheses[0].probability - hypotheses[1].probability : 1;
  const needsDiscrimination = hypotheses.length > 1 && (hEntropy > 0.74 || (topGap < 0.25 && topActions.size > 1));

  return {
    version: '1.0',
    turn_index: turnIndex,
    learner_project: {
      goal: 'make a task-relevant next move with learner-authored reasoning',
      current_plan: learnerText ? evidenceLine(learnerText, 'unknown learner plan') : 'unknown learner plan',
      commitment: /\b(i would|i choose|my strategy|because)\b/iu.test(learnerText) ? 'tentative' : 'uncommitted',
      next_authorship_opportunity: 'choose or justify the next task-relevant move',
    },
    hypotheses,
    axes: axesFromDialogueAndLedger(learnerText, interventionLedger),
    uncertainty: {
      entropy: Number(hEntropy.toFixed(6)),
      needs_discrimination: needsDiscrimination,
      reason: needsDiscrimination
        ? 'Top hypotheses remain close enough to require an information-gathering action.'
        : 'Dominant hypothesis is sufficiently separated for a targeted intervention.',
    },
  };
}

export function getActionDefinition(actionType) {
  const action = ADAPTATION_ACTION_BY_TYPE[actionType];
  if (!action) throw new Error(`adaptive actionPolicy: unknown action type ${JSON.stringify(actionType)}`);
  return clone(action);
}

function withActionDefaults(action, overrides = {}) {
  return {
    version: '1.0',
    id: overrides.id || `action-${action.action_type}`,
    action_type: action.action_type,
    description: action.description,
    target_axes: [...action.target_axes],
    rationale: overrides.rationale || action.description,
    preconditions: overrides.preconditions || [],
    expected_transition: { ...action.expected_transition },
    success_signal: clone(action.success_signal),
    control_cost: action.default_control_cost,
    information_gain: action.default_information_gain,
    forbidden_moves: [...action.forbidden_moves],
    registry_version: ADAPTATION_ACTION_REGISTRY_VERSION,
  };
}

function dominantHypothesis(stateBelief) {
  return stateBelief?.hypotheses?.[0]?.id || 'unknown';
}

function actionFitScore(action, hypotheses) {
  if (action.action_type === 'diagnose_with_discriminating_question') return 0.35;
  let score = 0;
  for (const h of hypotheses || []) {
    const compatible = action.compatible_hypotheses || [];
    if (compatible.includes(h.id)) score += h.probability;
  }
  return score;
}

function expectedStateGain(action) {
  const values = Object.values(action.expected_transition || {}).map((v) => Number(v) || 0);
  return values.reduce((sum, v) => sum + v, 0);
}

function ownershipGain(action) {
  return Number(action.expected_transition?.ownership || 0) + Number(action.expected_transition?.release || 0) * 0.5;
}

function dominantPreferredActionBonus(actionType, stateBelief) {
  const dominant = dominantHypothesis(stateBelief);
  return HYPOTHESIS_ACTION_MAP[dominant]?.[0] === actionType ? 0.35 : 0;
}

function recentFailedActions(interventionLedger = [], hypothesisId = null) {
  return interventionLedger
    .filter((record) => record?.status === 'closed' && record.outcome === 'failure')
    .filter((record) => !hypothesisId || (record.hypothesis_ids || []).includes(hypothesisId))
    .slice(-5);
}

function recentSuccessfulDiagnostic(interventionLedger = []) {
  return interventionLedger
    .filter((record) => record?.status === 'closed' && record.outcome === 'success')
    .slice(-3)
    .some((record) => record.action_type === 'diagnose_with_discriminating_question');
}

const ACTIONABLE_UNDER_UNCERTAINTY = new Set([
  'answer_seeking',
  'working_memory_overload',
  'notation_overload',
  'boundary_case',
  'substantive_objection',
  'metaphor_overextension',
  'affective_shutdown',
  'tutor_misread',
  'sophistication_upgrade',
  'false_mastery',
]);

function diagnosticStillRequired(stateBelief, interventionLedger = []) {
  if (!stateBelief?.uncertainty?.needs_discrimination) return false;
  const dominant = dominantHypothesis(stateBelief);
  if (ACTIONABLE_UNDER_UNCERTAINTY.has(dominant)) return false;
  if (recentSuccessfulDiagnostic(interventionLedger)) return false;
  return !recentFailedActions(interventionLedger, dominant).some(
    (r) => r.action_type === 'diagnose_with_discriminating_question',
  );
}

function materialFailureCount(interventionLedger, actionType, hypothesisId) {
  return recentFailedActions(interventionLedger, hypothesisId).filter((record) => record.action_type === actionType).length;
}

export function actionRepetitionPenalty(actionType, stateBelief, interventionLedger = [], config = {}) {
  const dominant = dominantHypothesis(stateBelief);
  const count = materialFailureCount(interventionLedger, actionType, dominant);
  return count * (config.repetitionPenalty ?? DEFAULT_ADAPTIVE_POLICY_CONFIG.repetitionPenalty);
}

function buildCandidateTypes(stateBelief, interventionLedger = []) {
  const dominant = dominantHypothesis(stateBelief);
  const types = new Set();
  if (stateBelief?.uncertainty?.needs_discrimination) types.add('diagnose_with_discriminating_question');
  for (const h of stateBelief?.hypotheses || []) {
    for (const type of HYPOTHESIS_ACTION_MAP[h.id] || []) {
      if (ADAPTATION_ACTION_BY_TYPE[type]) types.add(type);
    }
  }
  if (recentFailedActions(interventionLedger, dominant).length > 0) {
    types.add('contrast_models');
    types.add('explain_principle');
  }
  types.add('request_evidence');
  types.add('ask_strategy_choice');
  return [...types];
}

export function scoreCandidateAction(actionType, stateBelief, interventionLedger = [], config = {}) {
  const merged = { ...DEFAULT_ADAPTIVE_POLICY_CONFIG, ...config };
  const def = getActionDefinition(actionType);
  const fit = actionFitScore(def, stateBelief?.hypotheses || []);
  const uncertainty = stateBelief?.uncertainty?.needs_discrimination ? 1 : 0.25;
  const repetition = actionRepetitionPenalty(actionType, stateBelief, interventionLedger, merged);
  const preferredAction = dominantPreferredActionBonus(actionType, stateBelief);
  const mismatchRisk = Math.max(0, 0.45 - fit);
  const utility =
    expectedStateGain(def) +
    preferredAction +
    merged.actionFitWeight * fit +
    merged.uncertaintyWeight * uncertainty * def.default_information_gain +
    merged.ownershipWeight * ownershipGain(def) -
    merged.controlWeight * def.default_control_cost -
    repetition -
    mismatchRisk;
  return {
    action_type: actionType,
    utility: Number(utility.toFixed(6)),
    expected_state_gain: Number(expectedStateGain(def).toFixed(6)),
    state_action_fit: Number(fit.toFixed(6)),
    dominant_preferred_action_bonus: Number(preferredAction.toFixed(6)),
    information_gain: def.default_information_gain,
    control_cost: def.default_control_cost,
    repetition_penalty: Number(repetition.toFixed(6)),
    mismatch_risk: Number(mismatchRisk.toFixed(6)),
  };
}

export function selectPedagogicalAction({ stateBelief, interventionLedger = [], mode = 'closed_loop', config = {} } = {}) {
  const merged = { ...DEFAULT_ADAPTIVE_POLICY_CONFIG, ...config, mode };
  const candidateTypes = buildCandidateTypes(stateBelief, interventionLedger).slice(0, ADAPTATION_ACTIONS.length);
  let candidates = candidateTypes
    .map((type) => scoreCandidateAction(type, stateBelief, interventionLedger, merged))
    .sort((a, b) => b.utility - a.utility || a.control_cost - b.control_cost || b.information_gain - a.information_gain)
    .slice(0, merged.maxActionCandidates);

  if (diagnosticStillRequired(stateBelief, interventionLedger)) {
    const diagnostic = scoreCandidateAction('diagnose_with_discriminating_question', stateBelief, interventionLedger, merged);
    candidates = [diagnostic, ...candidates.filter((c) => c.action_type !== diagnostic.action_type)]
      .sort((a, b) => {
        if (a.action_type === 'diagnose_with_discriminating_question') return -1;
        if (b.action_type === 'diagnose_with_discriminating_question') return 1;
        return b.utility - a.utility || a.control_cost - b.control_cost;
      })
      .slice(0, merged.maxActionCandidates);
  }

  const diagnosticRequired = diagnosticStillRequired(stateBelief, interventionLedger);
  let selectedRow = diagnosticRequired
    ? candidates.find((c) => c.action_type === 'diagnose_with_discriminating_question')
    : null;
  if (!selectedRow) {
    const dominant = dominantHypothesis(stateBelief);
    if (ACTIONABLE_UNDER_UNCERTAINTY.has(dominant)) {
      const preferredType = HYPOTHESIS_ACTION_MAP[dominant]?.[0];
      const preferredRow = preferredType ? candidates.find((c) => c.action_type === preferredType) : null;
      const bestUtility = Math.max(...candidates.map((c) => c.utility));
      selectedRow =
        preferredRow && bestUtility - preferredRow.utility <= merged.utilityTieEpsilon ? preferredRow : candidates[0];
    } else {
      const bestUtility = Math.max(...candidates.map((c) => c.utility));
      const nearTied = candidates
        .filter((c) => bestUtility - c.utility <= merged.utilityTieEpsilon)
        .sort((a, b) => a.control_cost - b.control_cost || b.information_gain - a.information_gain);
      selectedRow = nearTied[0] || candidates[0];
    }
  }
  const selectedDef = getActionDefinition(selectedRow.action_type);
  const selectedAction = withActionDefaults(selectedDef, {
    id: `action-turn-${stateBelief?.turn_index ?? 0}`,
    rationale: `Dominant hypothesis ${dominantHypothesis(stateBelief)}; utility ${selectedRow.utility}; fit ${selectedRow.state_action_fit}.`,
  });

  return {
    mode,
    selectedAction,
    candidateActions: candidates,
    registryVersion: ADAPTATION_ACTION_REGISTRY_VERSION,
  };
}

export function legacyReactiveAction({ turnIndex = 0 } = {}) {
  const cycle = ['explain_principle', 'minimal_hint', 'contrast_models'];
  const action = getActionDefinition(cycle[Math.min(turnIndex, cycle.length - 1)]);
  return withActionDefaults(action, {
    id: `legacy-action-turn-${turnIndex}`,
    rationale: 'Legacy reactive baseline: explanation-first, then hint/contrast without closed-loop outcome tracking.',
  });
}
