/**
 * Shadow-only projection from the adaptive runner's concrete action enum into
 * the neutral PedagogicalMove boundary.
 *
 * This adapter does not select an action, mutate a contract, or choose a
 * register. The existing adaptive action remains authoritative.
 */

import { createPedagogicalMove } from '../pedagogicalMove/contract.js';
import { ADAPTATION_ACTION_REGISTRY_VERSION, ADAPTATION_ACTIONS } from './actionPolicy.js';
import { validatePedagogicalAction } from './adaptationContract.js';

export const ADAPTIVE_PEDAGOGICAL_MOVE_MAPPING_VERSION = 'machinespirits.adaptive-tutor.pedagogical-move-projection.v1';

export const ADAPTIVE_ACTION_TO_PEDAGOGICAL_MOVE = Object.freeze({
  observe_no_intervention: 'hold_space_for_independent_progress',
  diagnose_with_discriminating_question: 'ask_discriminating_question',
  elicit_prediction: 'elicit_learner_prediction',
  request_evidence: 'request_learner_evidence',
  ask_strategy_choice: 'invite_strategy_choice',
  contrast_models: 'contrast_candidate_models',
  fade_hint: 'fade_partial_hint',
  minimal_hint: 'offer_minimal_hint',
  lower_cognitive_load: 'simplify_to_one_workable_step',
  repair_overconfidence: 'ask_learner_to_check_claim',
  challenge_without_telling: 'pose_contradiction_without_answer',
  reanchor_goal: 'reconnect_to_task_goal',
  summarize_and_release: 'summarize_and_return_control',
  explain_principle: 'explain_governing_principle',
  model_worked_example: 'model_complete_worked_example',
  name_the_disagreement: 'state_substantive_disagreement',
  acknowledge_and_redirect: 'acknowledge_affect_and_redirect',
  repair_misrecognition: 'repair_misread_of_learner',
  mirror_and_extend: 'mirror_and_extend_reasoning',
  withhold_answer: 'withhold_answer_for_learner_attempt',
});

function targetReference(action) {
  return action.knowledge_component || action.task_id || null;
}

export function projectAdaptiveActionToPedagogicalMove(action) {
  const source = structuredClone(action || {});
  validatePedagogicalAction(source);
  const moveType = ADAPTIVE_ACTION_TO_PEDAGOGICAL_MOVE[source.action_type];
  if (!moveType) {
    throw new Error(`adaptivePedagogicalMoveProjection: unmapped action ${JSON.stringify(source.action_type)}`);
  }
  return createPedagogicalMove({
    moveType,
    target: {
      kind: 'learner_state_axes',
      reference: targetReference(source),
      axes: [...source.target_axes],
    },
    expectedUptake: {
      required_signals: [...(source.success_signal?.required_evidence || [])],
      forbidden_signals: [...(source.success_signal?.forbidden_evidence || [])],
      match: 'any',
      deadline_turns: null,
    },
    constraints: {
      required_moves: [],
      forbidden_moves: [...(source.forbidden_moves || [])],
    },
    transitionContract: {
      expected_state_delta: { ...(source.expected_transition || {}) },
      lifecycle: { success: null, defeat: null, expiry: null },
      terminal: false,
    },
    responsibilityOwner: source.responsibility_owner || null,
    compatibility: {
      action_type: source.action_type,
      action_family: source.move_family || null,
    },
    provenance: {
      host: 'adaptive_tutor',
      source_action: source.action_type,
      source_schema: source.schema || null,
      source_version: source.version || null,
      source_registry_version: source.registry_version || ADAPTATION_ACTION_REGISTRY_VERSION,
      mapping_version: ADAPTIVE_PEDAGOGICAL_MOVE_MAPPING_VERSION,
    },
  });
}

export function assertAdaptivePedagogicalMoveMappingComplete() {
  const sourceActions = ADAPTATION_ACTIONS.map((action) => action.action_type).sort();
  const mappedActions = Object.keys(ADAPTIVE_ACTION_TO_PEDAGOGICAL_MOVE).sort();
  if (JSON.stringify(sourceActions) !== JSON.stringify(mappedActions)) {
    throw new Error('adaptivePedagogicalMoveProjection: mapping must cover the exact adaptive action registry');
  }
  return true;
}
