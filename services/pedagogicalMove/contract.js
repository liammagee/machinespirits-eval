/**
 * Neutral, host-independent pedagogical-move contract.
 *
 * A move is the tutor's typed pedagogical commitment. It is downstream of a
 * warrant and upstream of any register, character, or other realization
 * choice. Host projections live beside their owning runtimes; this module must
 * not import tutor-stub, adaptive-tutor, model, store, or study code.
 */

export const PEDAGOGICAL_MOVE_SCHEMA = 'machinespirits.pedagogical-move.v1';
export const PEDAGOGICAL_MOVE_VERSION = '1.0';
export const PEDAGOGICAL_MOVE_CATALOG_VERSION = 'machinespirits.pedagogical-move-catalog.v1';

export const PEDAGOGICAL_MOVE_TYPES = Object.freeze([
  'acknowledge_affect_and_redirect',
  'answer_specific_public_request',
  'ask_discriminating_question',
  'ask_learner_to_check_claim',
  'challenge_to_agentive_evidence_move',
  'clarify_public_term',
  'contrast_candidate_models',
  'direct_attention_to_named_material',
  'elicit_learner_prediction',
  'explain_governing_principle',
  'fade_partial_hint',
  'hold_space_for_independent_progress',
  'invite_strategy_choice',
  'mirror_and_extend_reasoning',
  'model_complete_worked_example',
  'offer_minimal_hint',
  'pose_contradiction_without_answer',
  'receive_vulnerability_without_seizing_control',
  'reconnect_inquiry_to_lived_stake',
  'reconnect_to_task_goal',
  'repair_misread_of_learner',
  'request_compressed_sayback',
  'request_learner_evidence',
  'respond_plainly_without_policy_intervention',
  'restage_public_evidence',
  'restate_explanation_plainly',
  'simplify_to_one_workable_step',
  'stage_public_evidence_for_next_step',
  'state_outcome_and_close_inquiry',
  'state_substantive_disagreement',
  'summarize_and_return_control',
  'test_bounded_distinction',
  'withhold_answer_for_learner_attempt',
]);

const REALIZATION_ONLY_KEYS = Object.freeze(
  new Set([
    'actorial_part',
    'audience_register',
    'character',
    'engagement_stance',
    'learner_character',
    'lexical_accessibility',
    'performance_tactic',
    'register',
    'register_vector',
    'scene_immersion',
    'selected_register',
    'stance',
    'tone',
    'tutor_character',
  ]),
);

const RESPONSIBILITY_OWNERS = Object.freeze(new Set(['tutor', 'shared', 'learner']));

function clone(value) {
  return structuredClone(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`pedagogicalMove: ${label} must be an object`);
  }
  return value;
}

function requireString(value, label, { nullable = false } = {}) {
  if (nullable && value == null) return null;
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`pedagogicalMove: ${label} is required`);
  return normalized;
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error(`pedagogicalMove: ${label} must be an array of non-empty strings`);
  }
  return value;
}

function rejectRealizationKeys(value, path = 'move') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectRealizationKeys(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (REALIZATION_ONLY_KEYS.has(key)) {
      throw new Error(`pedagogicalMove: ${path}.${key} is a downstream realization field`);
    }
    rejectRealizationKeys(entry, `${path}.${key}`);
  }
}

function validateTarget(target) {
  requireObject(target, 'target');
  requireString(target.kind, 'target.kind');
  if (target.reference != null) requireString(target.reference, 'target.reference');
  requireStringArray(target.axes, 'target.axes');
}

function validateExpectedUptake(expectedUptake) {
  requireObject(expectedUptake, 'expected_uptake');
  requireStringArray(expectedUptake.required_signals, 'expected_uptake.required_signals');
  requireStringArray(expectedUptake.forbidden_signals, 'expected_uptake.forbidden_signals');
  if (!['any', 'all'].includes(expectedUptake.match)) {
    throw new Error('pedagogicalMove: expected_uptake.match must be any or all');
  }
  if (
    expectedUptake.deadline_turns != null &&
    (!Number.isInteger(expectedUptake.deadline_turns) || expectedUptake.deadline_turns < 0)
  ) {
    throw new Error('pedagogicalMove: expected_uptake.deadline_turns must be null or a non-negative integer');
  }
}

function validateConstraints(constraints) {
  requireObject(constraints, 'constraints');
  requireStringArray(constraints.required_moves, 'constraints.required_moves');
  requireStringArray(constraints.forbidden_moves, 'constraints.forbidden_moves');
}

function validateTransitionContract(transitionContract) {
  requireObject(transitionContract, 'transition_contract');
  requireObject(transitionContract.expected_state_delta, 'transition_contract.expected_state_delta');
  for (const [axis, value] of Object.entries(transitionContract.expected_state_delta)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < -1 || numeric > 1) {
      throw new Error(`pedagogicalMove: transition_contract.expected_state_delta.${axis} must be in [-1, 1]`);
    }
  }
  requireObject(transitionContract.lifecycle, 'transition_contract.lifecycle');
  for (const key of ['success', 'defeat', 'expiry']) {
    if (transitionContract.lifecycle[key] != null) {
      requireString(transitionContract.lifecycle[key], `transition_contract.lifecycle.${key}`);
    }
  }
  if (typeof transitionContract.terminal !== 'boolean') {
    throw new Error('pedagogicalMove: transition_contract.terminal must be boolean');
  }
}

function validateCompatibility(compatibility) {
  requireObject(compatibility, 'compatibility');
  if (compatibility.action_type != null) requireString(compatibility.action_type, 'compatibility.action_type');
  if (compatibility.action_family != null) requireString(compatibility.action_family, 'compatibility.action_family');
}

function validateProvenance(provenance) {
  requireObject(provenance, 'provenance');
  requireString(provenance.host, 'provenance.host');
  requireString(provenance.source_action, 'provenance.source_action');
  requireString(provenance.mapping_version, 'provenance.mapping_version');
  if (provenance.source_schema != null) requireString(provenance.source_schema, 'provenance.source_schema');
  if (provenance.source_version != null) requireString(provenance.source_version, 'provenance.source_version');
}

export function validatePedagogicalMove(move) {
  requireObject(move, 'move');
  rejectRealizationKeys(move);
  if (move.schema !== PEDAGOGICAL_MOVE_SCHEMA) {
    throw new Error(`pedagogicalMove: unsupported schema ${JSON.stringify(move.schema)}`);
  }
  if (move.version !== PEDAGOGICAL_MOVE_VERSION) {
    throw new Error(`pedagogicalMove: unsupported version ${JSON.stringify(move.version)}`);
  }
  if (!PEDAGOGICAL_MOVE_TYPES.includes(move.move_type)) {
    throw new Error(`pedagogicalMove: unknown move_type ${JSON.stringify(move.move_type)}`);
  }
  validateTarget(move.target);
  validateExpectedUptake(move.expected_uptake);
  validateConstraints(move.constraints);
  validateTransitionContract(move.transition_contract);
  if (move.responsibility_owner != null && !RESPONSIBILITY_OWNERS.has(move.responsibility_owner)) {
    throw new Error('pedagogicalMove: responsibility_owner must be tutor, shared, learner, or null');
  }
  validateCompatibility(move.compatibility);
  validateProvenance(move.provenance);
  return move;
}

export function createPedagogicalMove({
  moveType,
  target,
  expectedUptake,
  constraints = { required_moves: [], forbidden_moves: [] },
  transitionContract = { expected_state_delta: {}, lifecycle: {}, terminal: false },
  responsibilityOwner = null,
  compatibility = { action_type: null, action_family: null },
  provenance,
} = {}) {
  const move = {
    schema: PEDAGOGICAL_MOVE_SCHEMA,
    version: PEDAGOGICAL_MOVE_VERSION,
    move_type: requireString(moveType, 'move_type'),
    target: clone(target),
    expected_uptake: clone(expectedUptake),
    constraints: clone(constraints),
    transition_contract: clone(transitionContract),
    responsibility_owner: responsibilityOwner,
    compatibility: clone(compatibility),
    provenance: {
      ...clone(provenance),
      catalog_version: PEDAGOGICAL_MOVE_CATALOG_VERSION,
    },
  };
  return validatePedagogicalMove(move);
}
