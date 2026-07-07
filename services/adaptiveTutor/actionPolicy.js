import { classifyResistanceSignal, isKnownResistanceSignal } from '../resistanceSignalGate.js';

export const ADAPTATION_ACTION_REGISTRY_VERSION = 'adaptation-action-registry.v1.3';
export const ADAPTATION_POLICY_LAYER_VERSION = 'adaptation-policy-layer.v1.0';

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
  worldAdaptationWeight: 0.45,
  repetitionPenalty: 0.5,
  sameActionPenalty: 0,
  sameActionWindow: 3,
  sameActionScope: 'same_condition',
  utilityTieEpsilon: 0.05,
  resistanceSignalWeight: 0.45,
});

const RESISTANCE_SIGNAL_ROUTES = Object.freeze({
  boredom: {
    hypothesis_id: 'resistance_boredom',
    description: 'Learner can follow the proof surface but the task has become dead or disengaging.',
    preferred_actions: ['ask_strategy_choice', 'challenge_without_telling', 'request_evidence'],
    expected_resistance_transition: { resistance_breakthrough: 0.25, ownership: 0.12, release: 0.12 },
    success_evidence: ['renewed content-bearing work', 'learner-owned test case'],
    axis_adjustments: { affective_readiness: -0.12, ownership: -0.05 },
    weight: 1.1,
  },
  frustration: {
    hypothesis_id: 'resistance_frustration',
    description: 'Learner is stuck or annoyed; proof progress needs a smaller executable move.',
    preferred_actions: ['acknowledge_and_redirect', 'lower_cognitive_load', 'minimal_hint'],
    expected_resistance_transition: { resistance_breakthrough: 0.2, affective_readiness: 0.2 },
    success_evidence: ['renewed attempt after affective repair', 'smaller learner-owned move'],
    axis_adjustments: { affective_readiness: -0.2, metacognitive_accuracy: -0.05 },
    weight: 1.15,
  },
  irrelevance: {
    hypothesis_id: 'resistance_irrelevance',
    description: 'Learner challenges why the proof obligation matters for their own task.',
    preferred_actions: ['reanchor_goal', 'ask_strategy_choice', 'request_evidence'],
    expected_resistance_transition: { resistance_breakthrough: 0.25, metacognitive_accuracy: 0.15, ownership: 0.1 },
    success_evidence: ['learner-owned relevance test', 'task reorientation'],
    axis_adjustments: { metacognitive_accuracy: -0.08, ownership: -0.05 },
    weight: 1.12,
  },
  question_flood: {
    hypothesis_id: 'resistance_question_flood',
    description:
      'Learner floods the exchange with questions; the policy must collapse them into a discriminating hinge.',
    preferred_actions: ['diagnose_with_discriminating_question', 'name_the_disagreement', 'ask_strategy_choice'],
    expected_resistance_transition: { resistance_breakthrough: 0.18, metacognitive_accuracy: 0.18 },
    success_evidence: ['collapsed question set', 'state-disambiguating response'],
    axis_adjustments: { metacognitive_accuracy: -0.12 },
    weight: 1.1,
  },
  rote_parroting: {
    hypothesis_id: 'resistance_rote_parroting',
    description: 'Learner can repeat the sequence but has not turned it into an owned proof move.',
    preferred_actions: ['elicit_prediction', 'request_evidence', 'challenge_without_telling'],
    expected_resistance_transition: { resistance_breakthrough: 0.24, ownership: 0.14, proof: 0.08 },
    success_evidence: ['learner-authored prediction', 'non-formulaic learner rationale'],
    axis_adjustments: { proof: -0.05, ownership: -0.12 },
    weight: 1.14,
  },
});

const RESISTANCE_HYPOTHESIS_IDS = Object.freeze(
  Object.values(RESISTANCE_SIGNAL_ROUTES).map((route) => route.hypothesis_id),
);

const ACTIONS = [
  {
    action_type: 'observe_no_intervention',
    description: 'Hold back from adding new content when the learner is already making productive, owned progress.',
    target_axes: ['release', 'ownership'],
    default_control_cost: 0.05,
    default_information_gain: 0.25,
    expected_transition: { proof: 0.05, release: 0.25, ownership: 0.25, metacognitive_accuracy: 0.05 },
    success_signal: {
      description: 'Learner continues with an independent next move rather than waiting for tutor completion.',
      required_evidence: ['learner-authored next step', 'learner-authored choice'],
      forbidden_evidence: ['mere agreement', 'empty release'],
    },
    forbidden_moves: ['supply_decisive_step', 'replace_learner_plan', 'premature_correctness_validation'],
    compatible_hypotheses: ['productive_progress', 'low_confidence', 'approval_dependency'],
  },
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
      'resistance_question_flood',
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
    compatible_hypotheses: [
      'low_confidence',
      'answer_seeking',
      'procedure_without_rationale',
      'resistance_rote_parroting',
    ],
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
    compatible_hypotheses: [
      'correct_alternative_model',
      'procedure_without_rationale',
      'approval_dependency',
      'resistance_boredom',
      'resistance_irrelevance',
      'resistance_rote_parroting',
    ],
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
    compatible_hypotheses: [
      'approval_dependency',
      'answer_seeking',
      'low_confidence',
      'resistance_boredom',
      'resistance_irrelevance',
      'resistance_question_flood',
    ],
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
    compatible_hypotheses: [
      'missing_prerequisite',
      'notation_overload',
      'procedure_without_rationale',
      'resistance_frustration',
    ],
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
    compatible_hypotheses: [
      'working_memory_overload',
      'notation_overload',
      'missing_prerequisite',
      'resistance_frustration',
    ],
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
    compatible_hypotheses: [
      'boundary_case',
      'correct_alternative_model',
      'procedure_without_rationale',
      'resistance_boredom',
      'resistance_rote_parroting',
    ],
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
    compatible_hypotheses: ['task_misread', 'goal_drift', 'resistance_irrelevance'],
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
    description:
      'Supply conceptual material after lower-control moves are insufficient or prerequisite evidence is strong.',
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
    compatible_hypotheses: [
      'substantive_objection',
      'metaphor_overextension',
      'boundary_case',
      'resistance_question_flood',
    ],
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
    compatible_hypotheses: ['affective_shutdown', 'low_confidence', 'resistance_frustration'],
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
  productive_progress: ['observe_no_intervention', 'ask_strategy_choice', 'request_evidence'],
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
  resistance_boredom: ['ask_strategy_choice', 'challenge_without_telling', 'request_evidence'],
  resistance_frustration: ['acknowledge_and_redirect', 'lower_cognitive_load', 'minimal_hint'],
  resistance_irrelevance: ['reanchor_goal', 'ask_strategy_choice', 'request_evidence'],
  resistance_question_flood: ['diagnose_with_discriminating_question', 'name_the_disagreement', 'ask_strategy_choice'],
  resistance_rote_parroting: ['elicit_prediction', 'request_evidence', 'challenge_without_telling'],
});

const LEGACY_POLICY_ACTION_BY_ADAPTATION_ACTION = Object.freeze({
  observe_no_intervention: 'summarize_and_check',
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

function clampRange(value, min = -1, max = 1, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeResistanceSignalConfig(config = {}) {
  const target =
    config.resistanceSignalTarget ??
    config.resistance_signal_target ??
    config.targetResistanceSignal ??
    config.target_resistance_signal ??
    '';
  const rawEnabled =
    config.resistanceSignalPolicy ??
    config.resistance_signal_policy ??
    config.learnerResistancePolicy ??
    config.learner_resistance_policy ??
    null;
  const gate = config.resistanceSignalGate ?? config.resistance_signal_gate ?? [];
  const enabled =
    rawEnabled === true ||
    rawEnabled === 'true' ||
    rawEnabled === 'enabled' ||
    Boolean(target) ||
    (Array.isArray(gate) && gate.length > 0);
  return {
    enabled,
    targetSignal: isKnownResistanceSignal(target) ? target : '',
    gate: Array.isArray(gate) ? gate : [],
    weight: Number(config.resistanceSignalWeight ?? config.resistance_signal_weight ?? 0.45) || 0.45,
  };
}

function resistanceGateRouteForSignal(config, signal) {
  const gate = normalizeResistanceSignalConfig(config).gate;
  return (
    gate.find(
      (entry) => entry?.id === signal || entry?.expected_resistance_signal === signal || entry?.signal === signal,
    ) || null
  );
}

export function detectLearnerResistancePolicySignal(text, config = {}) {
  const signalConfig = normalizeResistanceSignalConfig(config);
  if (!signalConfig.enabled) return null;
  const observedSignal = classifyResistanceSignal(text, signalConfig.targetSignal);
  const route = observedSignal ? RESISTANCE_SIGNAL_ROUTES[observedSignal] : null;
  if (!route) return null;
  const gateRoute = resistanceGateRouteForSignal(config, observedSignal);
  const expectedStrategy =
    gateRoute?.expected_resistance_strategy ||
    config.resistanceSignalStrategy ||
    config.resistance_signal_strategy ||
    '';
  return {
    version: ADAPTATION_POLICY_LAYER_VERSION,
    kind: 'learner_resistance',
    target_signal: signalConfig.targetSignal || null,
    observed_signal: observedSignal,
    matched_target: signalConfig.targetSignal ? observedSignal === signalConfig.targetSignal : null,
    hypothesis_id: route.hypothesis_id,
    description: route.description,
    expected_strategy: expectedStrategy || null,
    preferred_actions: [...route.preferred_actions],
    evidence: evidenceLine(text, `${observedSignal} resistance signal`),
  };
}

function resistanceRouteFromStateBelief(stateBelief) {
  const signal = stateBelief?.policy_signals?.learner_resistance;
  if (!signal?.observed_signal) return null;
  return RESISTANCE_SIGNAL_ROUTES[signal.observed_signal] || null;
}

function resistanceSignalFromStateBelief(stateBelief) {
  return stateBelief?.policy_signals?.learner_resistance || null;
}

function applyResistanceSignalToWeights(weights, signal, config = {}) {
  if (!signal?.hypothesis_id) return weights;
  const route = RESISTANCE_SIGNAL_ROUTES[signal.observed_signal];
  if (!route) return weights;
  const matchBonus = signal.matched_target === true ? 0.18 : 0;
  const configWeight = normalizeResistanceSignalConfig(config).weight;
  weights[route.hypothesis_id] = (weights[route.hypothesis_id] || 0) + route.weight + configWeight + matchBonus;
  return weights;
}

function applyResistanceSignalToAxes(axes, signal) {
  const route = signal ? RESISTANCE_SIGNAL_ROUTES[signal.observed_signal] : null;
  if (!route) return axes;
  const next = { ...axes };
  for (const [axis, delta] of Object.entries(route.axis_adjustments || {})) {
    next[axis] = clamp01((Number(next[axis]) || 0) + Number(delta || 0), Number(next[axis]) || 0);
  }
  next.resistance_breakthrough = clamp01(next.resistance_breakthrough ?? 0.1, 0.1);
  return boundedAxisMap(next);
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
    productive_progress: 0.03,
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
      /\bi would\b/u,
      /\bi'?ll\b/u,
      /\bnext i\b/u,
      /\bmy strategy\b/u,
      /\bi choose\b/u,
      /\bi can try\b/u,
    ])
  ) {
    weights.productive_progress += 0.5;
    weights.low_confidence += 0.04;
  }
  if (includesAny(lower, [/\bbecause\b/u, /\btherefore\b/u, /\bso that\b/u, /\binvariant\b/u, /\bdepends on\b/u])) {
    weights.productive_progress += 0.36;
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
  if (
    includesAny(lower, [
      /third time/u,
      /still not clicking/u,
      /moving parts/u,
      /lose the thread/u,
      /too many concepts/u,
    ])
  ) {
    weights.working_memory_overload += 1.1;
    weights.notation_overload += 0.12;
  }
  if (
    includesAny(lower, [
      /thesis.*antithesis.*synthesis/u,
      /like 1\\+1/u,
      /like addition/u,
      /ingredients/u,
      /combine.*synthesis/u,
      /still in there/u,
    ])
  ) {
    weights.additive_misconception += 0.78;
    weights.correct_alternative_model += 0.08;
  }
  if (
    includesAny(lower, [
      /just tell/u,
      /give me (the )?answer/u,
      /what'?s the answer/u,
      /final answer/u,
      /walk me through (the )?answer/u,
      /just walk me through/u,
      /answer to the/u,
    ])
  ) {
    weights.answer_seeking += 0.72;
  }
  if (includesAny(lower, [/^yes[, ]/u, /^yes that makes sense/u, /^ok(ay)? that makes sense/u, /^makes sense/u])) {
    weights.false_mastery += 0.74;
    weights.approval_dependency += 0.12;
  }
  if (
    includesAny(lower, [
      /another way/u,
      /my model/u,
      /alternative/u,
      /counterexample/u,
      /different method/u,
      /different representation/u,
    ])
  ) {
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
  if (
    includesAny(lower, [
      /metaphor/u,
      /analogy/u,
      /like a mirror/u,
      /reflect everything/u,
      /without distortion/u,
      /has to be right/u,
    ])
  ) {
    weights.metaphor_overextension += 0.78;
    weights.correct_alternative_model += 0.12;
  }
  if (
    includesAny(lower, [
      /can'?t do this/u,
      /wasting your time/u,
      /i just\.\.\./u,
      /shut(?:ting)? down/u,
      /overwhelmed/u,
    ])
  ) {
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
  if (
    includesAny(lower, [
      /brandom/u,
      /expressivist/u,
      /hegel'?s text/u,
      /asymmetry you'?re invoking/u,
      /advanced reading/u,
    ])
  ) {
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

export function estimateLearnerStateBelief({
  dialogue = [],
  interventionLedger = [],
  turnIndex = 0,
  maxHypotheses = 3,
  config = {},
} = {}) {
  const learnerText = lastDialogueText(dialogue, 'learner');
  const learnerResistanceSignal = detectLearnerResistancePolicySignal(learnerText, config);
  const weights = weightFromText(learnerText, interventionLedger);
  applyResistanceSignalToWeights(weights, learnerResistanceSignal, config);
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

  const axes = applyResistanceSignalToAxes(
    axesFromDialogueAndLedger(learnerText, interventionLedger),
    learnerResistanceSignal,
  );

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
    axes,
    uncertainty: {
      entropy: Number(hEntropy.toFixed(6)),
      needs_discrimination: needsDiscrimination,
      reason: needsDiscrimination
        ? 'Top hypotheses remain close enough to require an information-gathering action.'
        : 'Dominant hypothesis is sufficiently separated for a targeted intervention.',
    },
    policy_signals: {
      learner_resistance: learnerResistanceSignal,
    },
  };
}

// Deterministic placebo for the state-scramble ablation (policy.state_scramble). Permute a
// belief so it no longer corresponds to the learner — reassign the probability mass to the
// wrong hypothesis ids (keeping dominant = highest, so the distribution shape and entropy are
// unchanged) and rotate the axis values across axis keys. The result stays schema-valid
// (same value multisets), so validateLearnerStateBelief still passes. If strategy shift
// survives a scrambled state, the policy is not actually keying on learner state.
// Deterministic in `seed` (turn index) for replay.
export function scrambleLearnerStateBelief(belief, seed = 0) {
  if (!belief) return belief;
  const rotateLeft = (arr, by) => arr.map((_, i) => arr[(i + by) % arr.length]);

  const hypotheses = Array.isArray(belief.hypotheses) ? belief.hypotheses.map((h) => ({ ...h })) : [];
  if (hypotheses.length > 1) {
    const by = Math.abs(Math.trunc(seed)) % hypotheses.length || 1;
    const rotated = rotateLeft(
      hypotheses.map((h) => h.probability),
      by,
    );
    hypotheses.forEach((h, i) => {
      h.probability = rotated[i];
    });
    hypotheses.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  }

  const axes = { ...(belief.axes || {}) };
  const axisKeys = Object.keys(axes);
  if (axisKeys.length > 1) {
    const by = Math.abs(Math.trunc(seed)) % axisKeys.length || 1;
    const rotated = rotateLeft(
      axisKeys.map((k) => axes[k]),
      by,
    );
    axisKeys.forEach((k, i) => {
      axes[k] = rotated[i];
    });
  }

  return { ...belief, hypotheses, axes };
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

function uniqueStrings(items = []) {
  return [
    ...new Set((items || []).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())),
  ];
}

export function normalizeWorldAdaptationSpec(config = {}) {
  const spec = config.worldAdaptationSpec || config.world_adaptation_spec || null;
  if (!spec || typeof spec !== 'object') return null;
  return spec;
}

export function summarizeWorldAdaptationSpec(spec) {
  if (!spec) return null;
  return {
    id: spec.id || null,
    version: spec.version || null,
    source_curriculum_id: spec.source_curriculum_id || null,
    module_id: spec.module_id || null,
    spec_hash: spec.spec_hash || null,
  };
}

export function worldActionList(spec, key, aliases = []) {
  const policy = spec?.action_policy || {};
  const values = Array.isArray(policy[key])
    ? policy[key]
    : aliases.map((alias) => policy[alias]).find((entry) => Array.isArray(entry)) || [];
  return uniqueStrings(values).filter((actionType) => ADAPTATION_ACTION_BY_TYPE[actionType]);
}

function worldActionSets(spec) {
  return {
    allowed: new Set(worldActionList(spec, 'allowed_action_families', ['allowed_actions'])),
    preferred: new Set(worldActionList(spec, 'preferred_action_families', ['preferred_actions'])),
    disallowed: new Set(worldActionList(spec, 'disallowed_action_families', ['disallowed_actions'])),
  };
}

// A world spec, once adopted, is a hash-bearing lock. createAdaptationContract requires a
// present spec to carry id + spec_hash, and worldActionList silently drops any family
// string that is not a registered action type — so a single typo empties the lock and
// fails OPEN (a disallowed action becomes permitted). Both failures otherwise surface only
// deep in the per-turn contract node (and only under architectures that wire it). Call this
// at spec adoption so a malformed spec is a clear, early error rather than a silently
// disabled lock or an opaque per-turn throw.
export function assertWorldAdaptationSpecUsable(spec) {
  if (!spec) return;
  if (!spec.id) throw new Error('world adaptation spec is missing a required id.');
  if (!spec.spec_hash) throw new Error(`world adaptation spec ${spec.id} is missing a required spec_hash.`);
  const policy = spec.action_policy || {};
  const unknown = [];
  for (const [key, alias] of [
    ['allowed_action_families', 'allowed_actions'],
    ['preferred_action_families', 'preferred_actions'],
    ['disallowed_action_families', 'disallowed_actions'],
  ]) {
    const values = Array.isArray(policy[key]) ? policy[key] : Array.isArray(policy[alias]) ? policy[alias] : [];
    for (const actionType of values) {
      if (!ADAPTATION_ACTION_BY_TYPE[actionType]) unknown.push(`${key}: ${actionType}`);
    }
  }
  if (unknown.length > 0) {
    throw new Error(
      `world adaptation spec ${spec.id} references unrecognized action families [${unknown.join('; ')}]. ` +
        `A misspelled family is silently dropped and disables the lock; fix the spec or register the action type.`,
    );
  }
}

export function actionPermittedByWorldSpec(actionType, spec) {
  if (!spec) return true;
  const { allowed, disallowed } = worldActionSets(spec);
  if (disallowed.has(actionType)) return false;
  if (allowed.size > 0 && !allowed.has(actionType)) return false;
  return true;
}

function applyWorldActionConstraints(candidateTypes, config = {}) {
  const spec = normalizeWorldAdaptationSpec(config);
  if (!spec) return uniqueStrings(candidateTypes);
  const { allowed, preferred, disallowed } = worldActionSets(spec);
  const withPreferred = uniqueStrings([
    ...[...preferred].filter((actionType) => ADAPTATION_ACTION_BY_TYPE[actionType]),
    ...candidateTypes,
  ]);
  let constrained = withPreferred.filter((actionType) => !disallowed.has(actionType));
  if (allowed.size > 0) constrained = constrained.filter((actionType) => allowed.has(actionType));
  if (constrained.length > 0) return constrained;

  const permittedPreferred = [...preferred].filter((actionType) => actionPermittedByWorldSpec(actionType, spec));
  if (permittedPreferred.length > 0) return permittedPreferred;
  return ADAPTATION_ACTIONS.map((action) => action.action_type).filter((actionType) =>
    actionPermittedByWorldSpec(actionType, spec),
  );
}

function worldExpectedTransitionForAction(spec, actionType) {
  const transitions = spec?.expected_transitions;
  if (Array.isArray(transitions)) return transitions.find((entry) => entry?.action_type === actionType) || null;
  if (transitions && typeof transitions === 'object') return transitions[actionType] || null;
  return null;
}

function worldForbiddenMoves(spec) {
  return uniqueStrings(
    (spec?.forbidden_moves || []).flatMap((entry) => {
      if (typeof entry === 'string') return [entry];
      if (!entry || typeof entry !== 'object') return [];
      return [entry.move, entry.id].filter(Boolean);
    }),
  );
}

function worldPreferenceBonus(actionType, spec, config = {}) {
  if (!spec) return 0;
  const { allowed, preferred, disallowed } = worldActionSets(spec);
  if (disallowed.has(actionType)) return -999;
  if (allowed.size > 0 && !allowed.has(actionType)) return -999;
  const weight = Number(config.worldAdaptationWeight ?? config.world_adaptation_weight ?? 0.45);
  if (preferred.has(actionType)) return weight;
  if (allowed.has(actionType)) return Math.min(0.08, weight * 0.2);
  return 0;
}

function resistanceSignalPreferenceBonus(actionType, stateBelief, config = {}) {
  const signal = resistanceSignalFromStateBelief(stateBelief);
  const route = resistanceRouteFromStateBelief(stateBelief);
  if (!signal || !route) return 0;
  const preferredIndex = route.preferred_actions.indexOf(actionType);
  if (preferredIndex < 0) return 0;
  const weight = Number(config.resistanceSignalWeight ?? config.resistance_signal_weight ?? 0.45) || 0.45;
  const targetMatchMultiplier = signal.matched_target === true ? 1.15 : 1;
  const rankMultiplier = preferredIndex === 0 ? 1 : preferredIndex === 1 ? 0.72 : 0.5;
  return weight * targetMatchMultiplier * rankMultiplier;
}

function typedEvidenceContractsEnabled(config = {}) {
  return config.typedEvidenceContracts === true || config.typed_evidence_contracts === true;
}

const RESISTANCE_SIGNAL_EVIDENCE_AXIS = Object.freeze({
  boredom: 'test_case',
  frustration: 'smaller_move',
  irrelevance: 'relevance',
  question_flood: 'collapsed_question',
  rote_parroting: 'prediction',
});

function buildTypedEvidenceContract({ action, route, signal } = {}) {
  const resistanceEvidence = uniqueStrings(route?.success_evidence || []);
  const resistanceSet = new Set(resistanceEvidence);
  let coreEvidence = uniqueStrings(
    (action?.success_signal?.required_evidence || []).filter((label) => !resistanceSet.has(label)),
  );
  if (action?.action_type === 'request_evidence' && !coreEvidence.includes('learner-authored rationale')) {
    coreEvidence = uniqueStrings(['learner-authored rationale', ...coreEvidence]);
  }
  return {
    version: 'adaptation-evidence-contract.v1',
    mode: 'proof_core_plus_resistance_core',
    core_evidence: coreEvidence,
    any_of_groups: resistanceEvidence.length
      ? [
          {
            id: 'resistance_core',
            axis: RESISTANCE_SIGNAL_EVIDENCE_AXIS[signal] || 'resistance_breakthrough',
            min: 1,
            labels: resistanceEvidence,
          },
        ]
      : [],
    supporting_evidence: resistanceEvidence,
  };
}

export function applyWorldAdaptationToAction(action, config = {}) {
  const spec = normalizeWorldAdaptationSpec(config);
  if (!action || !spec) return action;
  const transition = worldExpectedTransitionForAction(spec, action.action_type);
  const required = uniqueStrings([
    ...(action.success_signal?.required_evidence || []),
    ...(transition?.success_evidence || []),
  ]);
  const forbiddenEvidence = uniqueStrings([
    ...(action.success_signal?.forbidden_evidence || []),
    ...(transition?.failure_evidence || []),
  ]);
  const forbiddenMoves = uniqueStrings([...(action.forbidden_moves || []), ...worldForbiddenMoves(spec)]);
  return {
    ...action,
    rationale: `${action.rationale} World adaptation spec ${spec.id || 'unknown'} constrains this move for module ${
      spec.module_id || 'unknown'
    }.`,
    success_signal: {
      ...(action.success_signal || {}),
      required_evidence: required,
      forbidden_evidence: forbiddenEvidence,
      world_success_observables: uniqueStrings(transition?.world_success_observables || []),
    },
    forbidden_moves: forbiddenMoves,
    world_adaptation: summarizeWorldAdaptationSpec(spec),
  };
}

export function deriveAdaptationPolicyLayer({ stateBelief, config = {} } = {}) {
  const proofDag = summarizeWorldAdaptationSpec(normalizeWorldAdaptationSpec(config));
  const learnerResistance = resistanceSignalFromStateBelief(stateBelief);
  if (!proofDag && !learnerResistance) return null;
  return {
    version: ADAPTATION_POLICY_LAYER_VERSION,
    proof_dag: proofDag,
    learner_resistance: learnerResistance,
    policy_axes: ['proof', 'release', 'ownership', ...(learnerResistance ? ['resistance_breakthrough'] : [])],
  };
}

export function applyAdaptationPolicyLayerToAction(action, stateBelief, config = {}) {
  if (!action) return action;
  const layer = deriveAdaptationPolicyLayer({ stateBelief, config });
  if (!layer) return action;
  const route = resistanceRouteFromStateBelief(stateBelief);
  if (!route) {
    return {
      ...action,
      adaptation_policy_layer: layer,
    };
  }

  const requiredEvidence = uniqueStrings([
    ...(action.success_signal?.required_evidence || []),
    ...(route.success_evidence || []),
  ]);
  const expectedTransition = { ...(action.expected_transition || {}) };
  for (const [axis, gain] of Object.entries(route.expected_resistance_transition || {})) {
    expectedTransition[axis] = clampRange((Number(expectedTransition[axis]) || 0) + Number(gain || 0), -1, 1, 0);
  }

  const successSignal = {
    ...(action.success_signal || {}),
    required_evidence: requiredEvidence,
  };
  if (typedEvidenceContractsEnabled(config)) {
    const contract = buildTypedEvidenceContract({
      action: { ...action, success_signal: successSignal },
      route,
      signal: layer.learner_resistance?.observed_signal || null,
    });
    successSignal.evidence_contract = contract;
    successSignal.required_evidence = contract.core_evidence;
    successSignal.supporting_evidence = contract.supporting_evidence;
  }

  return {
    ...action,
    rationale: `${action.rationale} Learner resistance signal ${
      layer.learner_resistance?.observed_signal || 'unknown'
    } is routed through the same adaptation policy layer as proof/release/ownership state.`,
    expected_transition: expectedTransition,
    success_signal: successSignal,
    adaptation_policy_layer: layer,
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

function recentNonSuccessActions(interventionLedger = [], hypothesisId = null) {
  return interventionLedger
    .filter((record) => record?.status === 'closed' && ['failure', 'inconclusive'].includes(record.outcome))
    .filter((record) => !hypothesisId || (record.hypothesis_ids || []).includes(hypothesisId))
    .slice(-5);
}

function recentNonSuccessHintForMissingPrerequisite(stateBelief, interventionLedger = []) {
  const dominant = dominantHypothesis(stateBelief);
  const confidence = Number(stateBelief?.hypotheses?.[0]?.probability || 0);
  if (dominant !== 'missing_prerequisite' || confidence < 0.55) return false;
  return recentNonSuccessActions(interventionLedger, dominant).some((record) => record.action_type === 'minimal_hint');
}

function recentSuccessfulDiagnostic(interventionLedger = []) {
  return interventionLedger
    .filter((record) => record?.status === 'closed' && record.outcome === 'success')
    .slice(-3)
    .some((record) => record.action_type === 'diagnose_with_discriminating_question');
}

const ACTIONABLE_UNDER_UNCERTAINTY = new Set([
  'productive_progress',
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
  ...RESISTANCE_HYPOTHESIS_IDS,
]);

function diagnosticStillRequired(stateBelief, interventionLedger = []) {
  if (!stateBelief?.uncertainty?.needs_discrimination) return false;
  const dominant = dominantHypothesis(stateBelief);
  if (ACTIONABLE_UNDER_UNCERTAINTY.has(dominant)) return false;
  if (recentSuccessfulDiagnostic(interventionLedger)) return false;
  if (recentDiagnosticNonSuccess(stateBelief, interventionLedger)) return false;
  return !recentFailedActions(interventionLedger, dominant).some(
    (r) => r.action_type === 'diagnose_with_discriminating_question',
  );
}

function recentClosedActions(interventionLedger = [], limit = 3) {
  const boundedLimit = Math.max(1, Number(limit) || 3);
  return interventionLedger.filter((record) => record?.status === 'closed').slice(-boundedLimit);
}

function materiallySameLearnerCondition(record, stateBelief) {
  const dominant = dominantHypothesis(stateBelief);
  if (!dominant || dominant === 'unknown') return false;
  const priorHypotheses = new Set(record?.hypothesis_ids || []);
  const hasCurrentOverlap = (stateBelief?.hypotheses || []).some(
    (h) => priorHypotheses.has(h.id) && Number(h.probability || 0) >= 0.25,
  );
  if (!hasCurrentOverlap) return false;
  const dominantProbability = Number(stateBelief?.hypotheses?.[0]?.probability || 0);
  return dominantProbability >= 0.3 || stateBelief?.uncertainty?.needs_discrimination === true;
}

function recentDiagnosticNonSuccess(stateBelief, interventionLedger = []) {
  return recentClosedActions(interventionLedger, 5).some(
    (record) =>
      record.action_type === 'diagnose_with_discriminating_question' &&
      ['failure', 'inconclusive'].includes(record.outcome) &&
      materiallySameLearnerCondition(record, stateBelief),
  );
}

function materialNonSuccessCount(interventionLedger, actionType, stateBelief) {
  const dominant = dominantHypothesis(stateBelief);
  return recentNonSuccessActions(interventionLedger, dominant).filter((record) => {
    if (record.action_type !== actionType) return false;
    if (!materiallySameLearnerCondition(record, stateBelief)) return false;
    return record.outcome === 'failure' || actionType === 'diagnose_with_discriminating_question';
  }).length;
}

export function actionRecencyPenalty(actionType, stateBelief, interventionLedger = [], config = {}) {
  const penalty = Number(config.sameActionPenalty ?? DEFAULT_ADAPTIVE_POLICY_CONFIG.sameActionPenalty) || 0;
  if (penalty <= 0) return 0;
  const window = Number(config.sameActionWindow ?? DEFAULT_ADAPTIVE_POLICY_CONFIG.sameActionWindow) || 3;
  const scope = config.sameActionScope ?? DEFAULT_ADAPTIVE_POLICY_CONFIG.sameActionScope;
  const repeats = recentClosedActions(interventionLedger, window).filter(
    (record) =>
      record.action_type === actionType &&
      (scope === 'any_recent' || materiallySameLearnerCondition(record, stateBelief)),
  );
  return repeats.length * penalty;
}

export function actionRepetitionPenalty(actionType, stateBelief, interventionLedger = [], config = {}) {
  const count = materialNonSuccessCount(interventionLedger, actionType, stateBelief);
  const failurePenalty = count * (config.repetitionPenalty ?? DEFAULT_ADAPTIVE_POLICY_CONFIG.repetitionPenalty);
  return failurePenalty + actionRecencyPenalty(actionType, stateBelief, interventionLedger, config);
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
  if (recentNonSuccessActions(interventionLedger, dominant).length > 0) {
    types.add('contrast_models');
    types.add('explain_principle');
  }
  types.add('request_evidence');
  types.add('ask_strategy_choice');
  return [...types];
}

export function scoreCandidateAction(actionType, stateBelief, interventionLedger = [], config = {}) {
  const merged = { ...DEFAULT_ADAPTIVE_POLICY_CONFIG, ...config };
  const worldSpec = normalizeWorldAdaptationSpec(merged);
  const def = getActionDefinition(actionType);
  const fit = actionFitScore(def, stateBelief?.hypotheses || []);
  const uncertainty = stateBelief?.uncertainty?.needs_discrimination ? 1 : 0.25;
  const repetition = actionRepetitionPenalty(actionType, stateBelief, interventionLedger, merged);
  const recency = actionRecencyPenalty(actionType, stateBelief, interventionLedger, merged);
  const preferredAction = dominantPreferredActionBonus(actionType, stateBelief);
  const worldBonus = worldPreferenceBonus(actionType, worldSpec, merged);
  const resistanceBonus = resistanceSignalPreferenceBonus(actionType, stateBelief, merged);
  const mismatchRisk = Math.max(0, 0.45 - fit);
  const utility =
    expectedStateGain(def) +
    preferredAction +
    worldBonus +
    resistanceBonus +
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
    same_action_penalty: Number(recency.toFixed(6)),
    mismatch_risk: Number(mismatchRisk.toFixed(6)),
    world_adaptation_bonus: Number(worldBonus.toFixed(6)),
    resistance_signal_bonus: Number(resistanceBonus.toFixed(6)),
    world_adaptation: summarizeWorldAdaptationSpec(worldSpec),
    learner_resistance_signal: resistanceSignalFromStateBelief(stateBelief),
  };
}

export function selectPedagogicalAction({
  stateBelief,
  interventionLedger = [],
  mode = 'closed_loop',
  config = {},
} = {}) {
  const merged = { ...DEFAULT_ADAPTIVE_POLICY_CONFIG, ...config, mode };
  const worldSpec = normalizeWorldAdaptationSpec(merged);
  const candidateTypes = applyWorldActionConstraints(
    buildCandidateTypes(stateBelief, interventionLedger),
    merged,
  ).slice(0, ADAPTATION_ACTIONS.length);
  if (candidateTypes.length === 0) {
    throw new Error('adaptive actionPolicy: world adaptation spec disallowed every candidate action');
  }
  let candidates = candidateTypes
    .map((type) => scoreCandidateAction(type, stateBelief, interventionLedger, merged))
    .sort((a, b) => b.utility - a.utility || a.control_cost - b.control_cost || b.information_gain - a.information_gain)
    .slice(0, merged.maxActionCandidates);

  const escalationRequired = recentNonSuccessHintForMissingPrerequisite(stateBelief, interventionLedger);

  if (
    diagnosticStillRequired(stateBelief, interventionLedger) &&
    !escalationRequired &&
    actionPermittedByWorldSpec('diagnose_with_discriminating_question', worldSpec)
  ) {
    const diagnostic = scoreCandidateAction(
      'diagnose_with_discriminating_question',
      stateBelief,
      interventionLedger,
      merged,
    );
    candidates = [diagnostic, ...candidates.filter((c) => c.action_type !== diagnostic.action_type)]
      .sort((a, b) => {
        if (a.action_type === 'diagnose_with_discriminating_question') return -1;
        if (b.action_type === 'diagnose_with_discriminating_question') return 1;
        return b.utility - a.utility || a.control_cost - b.control_cost;
      })
      .slice(0, merged.maxActionCandidates);
  }

  if (escalationRequired && actionPermittedByWorldSpec('explain_principle', worldSpec)) {
    const escalation = scoreCandidateAction('explain_principle', stateBelief, interventionLedger, merged);
    candidates = [escalation, ...candidates.filter((c) => c.action_type !== escalation.action_type)].slice(
      0,
      merged.maxActionCandidates,
    );
  }

  const diagnosticRequired =
    diagnosticStillRequired(stateBelief, interventionLedger) &&
    !escalationRequired &&
    actionPermittedByWorldSpec('diagnose_with_discriminating_question', worldSpec);
  let selectedRow = escalationRequired
    ? candidates.find((c) => c.action_type === 'explain_principle') ||
      candidates.find((c) => c.action_type === 'model_worked_example')
    : null;
  if (!selectedRow) {
    selectedRow = diagnosticRequired
      ? candidates.find((c) => c.action_type === 'diagnose_with_discriminating_question')
      : null;
  }
  if (!selectedRow) {
    const dominant = dominantHypothesis(stateBelief);
    const preferredType = HYPOTHESIS_ACTION_MAP[dominant]?.[0];
    const preferredRow = preferredType ? candidates.find((c) => c.action_type === preferredType) : null;
    if (
      recentDiagnosticNonSuccess(stateBelief, interventionLedger) &&
      preferredRow &&
      preferredRow.action_type !== 'diagnose_with_discriminating_question'
    ) {
      selectedRow = preferredRow;
    }
    if (ACTIONABLE_UNDER_UNCERTAINTY.has(dominant)) {
      const bestUtility = Math.max(...candidates.map((c) => c.utility));
      if (!selectedRow) {
        selectedRow =
          preferredRow &&
          (recentDiagnosticNonSuccess(stateBelief, interventionLedger) ||
            bestUtility - preferredRow.utility <= merged.utilityTieEpsilon)
            ? preferredRow
            : candidates[0];
      }
    } else if (!selectedRow) {
      const bestUtility = Math.max(...candidates.map((c) => c.utility));
      const nearTied = candidates
        .filter((c) => bestUtility - c.utility <= merged.utilityTieEpsilon)
        .sort((a, b) => a.control_cost - b.control_cost || b.information_gain - a.information_gain);
      selectedRow = nearTied[0] || candidates[0];
    }
  }
  const selectedDef = getActionDefinition(selectedRow.action_type);
  const selectedAction = applyAdaptationPolicyLayerToAction(
    applyWorldAdaptationToAction(
      withActionDefaults(selectedDef, {
        id: `action-turn-${stateBelief?.turn_index ?? 0}`,
        rationale: `Dominant hypothesis ${dominantHypothesis(stateBelief)}; utility ${selectedRow.utility}; fit ${selectedRow.state_action_fit}.`,
      }),
      merged,
    ),
    stateBelief,
    merged,
  );

  return {
    mode,
    selectedAction,
    candidateActions: candidates,
    registryVersion: ADAPTATION_ACTION_REGISTRY_VERSION,
    worldAdaptationSpec: summarizeWorldAdaptationSpec(worldSpec),
    adaptationPolicyLayer: deriveAdaptationPolicyLayer({ stateBelief, config: merged }),
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
