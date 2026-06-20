import { getActionDefinition } from './actionPolicy.js';

export const ADAPTATION_CONTRACT_VERSION = '1.0';
export const ADAPTATION_CONTRACT_SCHEMA = 'adaptive-tutor.adaptation-contract.v1.0';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`adaptationContract: ${label} must be an object`);
  }
  return value;
}

function assertBounded(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`adaptationContract: ${label} must be in [0, 1]`);
  }
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`adaptationContract: ${label} must be an array of strings`);
  }
}

export function validateLearnerStateBelief(belief, { probabilityTolerance = 0.02 } = {}) {
  requireObject(belief, 'state_belief');
  if (belief.version !== ADAPTATION_CONTRACT_VERSION) {
    throw new Error(`adaptationContract: unsupported learner-state belief version ${JSON.stringify(belief.version)}`);
  }
  requireObject(belief.learner_project, 'state_belief.learner_project');
  if (!belief.learner_project.goal) throw new Error('adaptationContract: learner_project.goal is required');
  if (!belief.learner_project.next_authorship_opportunity) {
    throw new Error('adaptationContract: learner_project.next_authorship_opportunity is required');
  }
  if (!Array.isArray(belief.hypotheses) || belief.hypotheses.length === 0) {
    throw new Error('adaptationContract: state_belief.hypotheses must be non-empty');
  }
  let sum = 0;
  for (const [idx, h] of belief.hypotheses.entries()) {
    requireObject(h, `state_belief.hypotheses[${idx}]`);
    if (!h.id) throw new Error(`adaptationContract: hypothesis ${idx} missing id`);
    assertBounded(h.probability, `hypothesis ${h.id}.probability`);
    sum += Number(h.probability);
    assertStringArray(h.evidence, `hypothesis ${h.id}.evidence`);
    assertStringArray(h.disconfirming_evidence || [], `hypothesis ${h.id}.disconfirming_evidence`);
    if (Number(h.probability) >= 0.7 && h.evidence.length === 0) {
      throw new Error(`adaptationContract: high-confidence hypothesis ${h.id} lacks evidence`);
    }
  }
  if (Math.abs(sum - 1) > probabilityTolerance) {
    throw new Error(`adaptationContract: hypothesis probabilities sum to ${sum.toFixed(4)}, not 1`);
  }
  requireObject(belief.axes, 'state_belief.axes');
  for (const [axis, value] of Object.entries(belief.axes)) assertBounded(value, `axis ${axis}`);
  requireObject(belief.uncertainty, 'state_belief.uncertainty');
  assertBounded(belief.uncertainty.entropy, 'uncertainty.entropy');
  if (typeof belief.uncertainty.needs_discrimination !== 'boolean') {
    throw new Error('adaptationContract: uncertainty.needs_discrimination must be boolean');
  }
  return belief;
}

export function validatePedagogicalAction(action) {
  requireObject(action, 'selected_action');
  if (action.version !== ADAPTATION_CONTRACT_VERSION) {
    throw new Error(`adaptationContract: unsupported action version ${JSON.stringify(action.version)}`);
  }
  const def = getActionDefinition(action.action_type);
  assertStringArray(action.target_axes, 'selected_action.target_axes');
  if (action.target_axes.some((axis) => !def.target_axes.includes(axis))) {
    throw new Error(`adaptationContract: selected_action ${action.action_type} has unsupported target axis`);
  }
  requireObject(action.expected_transition, 'selected_action.expected_transition');
  for (const [axis, value] of Object.entries(action.expected_transition)) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < -1 || n > 1) {
      throw new Error(`adaptationContract: expected_transition.${axis} must be in [-1, 1]`);
    }
  }
  requireObject(action.success_signal, 'selected_action.success_signal');
  assertStringArray(action.success_signal.required_evidence || [], 'selected_action.success_signal.required_evidence');
  assertStringArray(action.success_signal.forbidden_evidence || [], 'selected_action.success_signal.forbidden_evidence');
  assertBounded(action.control_cost, 'selected_action.control_cost');
  assertBounded(action.information_gain, 'selected_action.information_gain');
  assertStringArray(action.forbidden_moves || [], 'selected_action.forbidden_moves');
  if ((action.target_axes || []).includes('ownership') && !action.success_signal.required_evidence?.length) {
    throw new Error('adaptationContract: ownership-targeting action needs observable success evidence');
  }
  return action;
}

export function validateGateResult(gateResult = { allowed: true, violations: [], repairs: [] }) {
  requireObject(gateResult, 'gate_result');
  if (typeof gateResult.allowed !== 'boolean') throw new Error('adaptationContract: gate_result.allowed must be boolean');
  if (!Array.isArray(gateResult.violations)) throw new Error('adaptationContract: gate_result.violations must be an array');
  if (!Array.isArray(gateResult.repairs)) throw new Error('adaptationContract: gate_result.repairs must be an array');
  return gateResult;
}

export function createAdaptationContract({
  contractId,
  dialogueId = 'dialogue',
  turnIndex,
  stateBelief,
  selectedAction,
  candidateActions = [],
  gateResult = { allowed: true, violations: [], repairs: [] },
  realizationChecks = { action_consistent: null, forbidden_move_detected: null },
  policyMode = 'closed_loop',
  worldAdaptationSpec = null,
} = {}) {
  const normalized = {
    schema: ADAPTATION_CONTRACT_SCHEMA,
    version: ADAPTATION_CONTRACT_VERSION,
    contract_id: contractId || `${dialogueId}-turn-${turnIndex ?? stateBelief?.turn_index ?? 0}`,
    dialogue_id: dialogueId,
    turn_index: turnIndex ?? stateBelief?.turn_index ?? 0,
    policy_mode: policyMode,
    state_belief: clone(validateLearnerStateBelief(clone(stateBelief))),
    selected_action: clone(validatePedagogicalAction(clone(selectedAction))),
    candidate_actions: clone(candidateActions),
    gate_result: clone(validateGateResult(gateResult)),
    realization_checks: clone(realizationChecks),
    world_adaptation_spec: worldAdaptationSpec ? clone(worldAdaptationSpec) : null,
  };
  return validateAdaptationContract(normalized);
}

export function validateAdaptationContract(contract) {
  requireObject(contract, 'contract');
  if (contract.schema !== ADAPTATION_CONTRACT_SCHEMA) {
    throw new Error(`adaptationContract: unsupported schema ${JSON.stringify(contract.schema)}`);
  }
  if (contract.version !== ADAPTATION_CONTRACT_VERSION) {
    throw new Error(`adaptationContract: unsupported contract version ${JSON.stringify(contract.version)}`);
  }
  if (!contract.contract_id) throw new Error('adaptationContract: contract_id is required');
  validateLearnerStateBelief(contract.state_belief);
  validatePedagogicalAction(contract.selected_action);
  validateGateResult(contract.gate_result);
  requireObject(contract.realization_checks || {}, 'realization_checks');
  if (contract.world_adaptation_spec != null) {
    requireObject(contract.world_adaptation_spec, 'world_adaptation_spec');
    if (!contract.world_adaptation_spec.id) {
      throw new Error('adaptationContract: world_adaptation_spec.id is required when present');
    }
    if (!contract.world_adaptation_spec.spec_hash) {
      throw new Error('adaptationContract: world_adaptation_spec.spec_hash is required when present');
    }
  }
  if (!Array.isArray(contract.candidate_actions)) {
    throw new Error('adaptationContract: candidate_actions must be an array');
  }
  return contract;
}

export function updateContractRealizationChecks(contract, realizationChecks) {
  const next = {
    ...clone(contract),
    realization_checks: { ...(contract?.realization_checks || {}), ...clone(realizationChecks) },
  };
  return validateAdaptationContract(next);
}
