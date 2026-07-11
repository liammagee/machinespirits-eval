import { ADAPTATION_ACTION_REGISTRY_VERSION, getActionDefinition } from './actionPolicy.js';
import {
  PEDAGOGICAL_ACTION_SCHEMA,
  PEDAGOGICAL_ACTION_VERSION,
  validatePedagogicalAction,
} from './adaptationContract.js';

export const TUTOR_STUB_TYPED_ACTION_DECISION_SCHEMA = 'machinespirits.tutor-stub.typed-action-decision.v1';

export const TUTOR_STUB_MOVE_FAMILIES = Object.freeze([
  'diagnose_elicit',
  'minimal_support',
  'explain_model',
  'request_self_explanation',
  'fade_transfer',
]);

const MOVE_FAMILY_BY_ACTION = Object.freeze({
  observe_no_intervention: 'fade_transfer',
  diagnose_with_discriminating_question: 'diagnose_elicit',
  elicit_prediction: 'diagnose_elicit',
  request_evidence: 'request_self_explanation',
  ask_strategy_choice: 'request_self_explanation',
  contrast_models: 'diagnose_elicit',
  fade_hint: 'fade_transfer',
  minimal_hint: 'minimal_support',
  lower_cognitive_load: 'minimal_support',
  repair_overconfidence: 'request_self_explanation',
  challenge_without_telling: 'request_self_explanation',
  reanchor_goal: 'minimal_support',
  summarize_and_release: 'fade_transfer',
  explain_principle: 'explain_model',
  model_worked_example: 'explain_model',
  name_the_disagreement: 'diagnose_elicit',
  acknowledge_and_redirect: 'minimal_support',
  repair_misrecognition: 'diagnose_elicit',
  mirror_and_extend: 'fade_transfer',
  withhold_answer: 'fade_transfer',
});

const DEFAULT_SUPPORT_BY_ACTION = Object.freeze({
  observe_no_intervention: 0,
  diagnose_with_discriminating_question: 1,
  elicit_prediction: 1,
  request_evidence: 0,
  ask_strategy_choice: 1,
  contrast_models: 1,
  fade_hint: 0,
  minimal_hint: 1,
  lower_cognitive_load: 2,
  repair_overconfidence: 1,
  challenge_without_telling: 0,
  reanchor_goal: 1,
  summarize_and_release: 0,
  explain_principle: 2,
  model_worked_example: 3,
  name_the_disagreement: 1,
  acknowledge_and_redirect: 2,
  repair_misrecognition: 1,
  mirror_and_extend: 1,
  withhold_answer: 0,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nonEmpty(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`tutorStubActionAdapter: ${label} is required`);
  return normalized;
}

function boundedDifficulty(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new Error('tutorStubActionAdapter: itemDifficulty must be in [0, 1]');
  }
  return numeric;
}

function supportLevel(value, actionType) {
  const numeric = value == null ? DEFAULT_SUPPORT_BY_ACTION[actionType] : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 3) {
    throw new Error('tutorStubActionAdapter: supportLevel must be an integer in [0, 3]');
  }
  return numeric;
}

function responsibilityOwner(moveFamily, level) {
  if (moveFamily === 'fade_transfer' || moveFamily === 'request_self_explanation') return 'learner';
  if (moveFamily === 'explain_model' && level >= 2) return 'tutor';
  return 'shared';
}

export function tutorStubMoveFamilyForAction(actionType) {
  getActionDefinition(actionType);
  return MOVE_FAMILY_BY_ACTION[actionType];
}

export function adaptPedagogicalActionToTutorStub({
  action,
  task,
  register,
  supportLevel = null,
  expectedEvidence = null,
  fadeCondition = null,
  independentWorkWindow = null,
  responsibility = null,
} = {}) {
  const source = clone(action || {});
  validatePedagogicalAction(source);
  const definition = getActionDefinition(source.action_type);
  const moveFamily = tutorStubMoveFamilyForAction(source.action_type);
  const level =
    supportLevel === null
      ? supportLevelForAction(source.action_type)
      : supportLevelForAction(source.action_type, supportLevel);
  const taskSource = task && typeof task === 'object' ? task : {};
  const normalized = {
    ...source,
    schema: PEDAGOGICAL_ACTION_SCHEMA,
    version: PEDAGOGICAL_ACTION_VERSION,
    move_family: moveFamily,
    support_level: level,
    task_id: nonEmpty(taskSource.taskId ?? taskSource.task_id, 'task.taskId'),
    knowledge_component: nonEmpty(
      taskSource.knowledgeComponent ?? taskSource.knowledge_component,
      'task.knowledgeComponent',
    ),
    prerequisite_path: Array.isArray(taskSource.prerequisitePath ?? taskSource.prerequisite_path)
      ? [...(taskSource.prerequisitePath ?? taskSource.prerequisite_path)].map(String)
      : [],
    item_difficulty: boundedDifficulty(taskSource.itemDifficulty ?? taskSource.item_difficulty),
    register: nonEmpty(register, 'register'),
    expected_evidence: {
      success: [
        ...new Set(
          (expectedEvidence?.success || source.success_signal?.required_evidence || []).map((value) => String(value)),
        ),
      ],
      failure: [
        ...new Set(
          (expectedEvidence?.failure || source.success_signal?.forbidden_evidence || []).map((value) => String(value)),
        ),
      ],
    },
    fade_condition: fadeCondition || {
      when: moveFamily === 'fade_transfer' ? 'after_success_signal' : 'after_observed_uptake',
      evidence: [...(source.success_signal?.required_evidence || [])],
    },
    independent_work_window:
      independentWorkWindow == null ? (moveFamily === 'fade_transfer' ? 1 : 0) : Number(independentWorkWindow),
    responsibility_owner: responsibility || responsibilityOwner(moveFamily, level),
    registry_version: source.registry_version || ADAPTATION_ACTION_REGISTRY_VERSION,
    source_action_version: source.version,
    source_action_definition: definition.action_type,
  };
  return validatePedagogicalAction(normalized);
}

export function supportLevelForAction(actionType, override = null) {
  getActionDefinition(actionType);
  return supportLevel(override, actionType);
}

function normalizedCandidate(candidate = {}) {
  return {
    ...clone(candidate),
    action_type: nonEmpty(candidate.action_type, 'candidate.action_type'),
    utility: Number.isFinite(Number(candidate.utility)) ? Number(candidate.utility) : null,
    state_action_fit: Number.isFinite(Number(candidate.state_action_fit)) ? Number(candidate.state_action_fit) : null,
    control_cost: Number.isFinite(Number(candidate.control_cost)) ? Number(candidate.control_cost) : null,
    information_gain: Number.isFinite(Number(candidate.information_gain)) ? Number(candidate.information_gain) : null,
    repetition_penalty: Number.isFinite(Number(candidate.repetition_penalty))
      ? Number(candidate.repetition_penalty)
      : null,
  };
}

export function buildTutorStubTypedActionDecision({
  selection,
  stateBelief,
  task,
  register,
  supportLevel: selectedSupportLevel = null,
  selectionProbability = 1,
  vetoes = [],
  policyVersion = null,
  modelVersion = null,
} = {}) {
  const selectedAction = selection?.selectedAction || selection?.selected_action;
  if (!selectedAction) throw new Error('tutorStubActionAdapter: selection.selectedAction is required');
  const probability = Number(selectionProbability);
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error('tutorStubActionAdapter: selectionProbability must be in [0, 1]');
  }
  const action = adaptPedagogicalActionToTutorStub({
    action: selectedAction,
    task,
    register,
    supportLevel: selectedSupportLevel,
  });
  const candidates = (selection?.candidateActions || selection?.candidate_actions || []).map(normalizedCandidate);
  return {
    schema: TUTOR_STUB_TYPED_ACTION_DECISION_SCHEMA,
    state_version: stateBelief?.version || null,
    policy_version: policyVersion || selection?.registryVersion || ADAPTATION_ACTION_REGISTRY_VERSION,
    model_version: modelVersion || null,
    state_belief: clone(stateBelief || null),
    full_candidate_set: candidates,
    candidate_scores: Object.fromEntries(candidates.map((candidate) => [candidate.action_type, candidate.utility])),
    chosen_action: action,
    selection_probability: probability,
    vetoes_and_repairs: clone(Array.isArray(vetoes) ? vetoes : []),
    response_configuration_patch: {
      action_family: action.move_family,
      support_level: action.support_level,
      task_id: action.task_id,
      knowledge_component: action.knowledge_component,
      item_difficulty: action.item_difficulty,
    },
    register_selection: {
      engagement_stance: action.register,
      selected_register: action.register,
    },
  };
}
