import { ADAPTATION_CONTRACT_VERSION } from './adaptationContract.js';
import { observeInterventionOutcome } from './outcomeObserver.js';

export const INTERVENTION_LEDGER_VERSION = 'adaptation-intervention-ledger.v1.0';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pendingRecords(ledger = []) {
  return ledger.filter((record) => record?.status === 'pending');
}

export function createPendingIntervention(contract) {
  if (!contract?.contract_id) throw new Error('interventionLedger: contract_id is required');
  const action = contract.selected_action;
  return {
    version: ADAPTATION_CONTRACT_VERSION,
    ledger_version: INTERVENTION_LEDGER_VERSION,
    contract_id: contract.contract_id,
    turn_index: contract.turn_index,
    hypothesis_ids: (contract.state_belief?.hypotheses || []).map((h) => h.id),
    action_type: action.action_type,
    expected_transition: clone(action.expected_transition || {}),
    success_signal: clone(action.success_signal || {}),
    original_success_signal: clone(action.success_signal || {}),
    adaptation_policy_layer: clone(action.adaptation_policy_layer || null),
    status: 'pending',
    observed_transition: null,
    outcome: null,
    evidence: [],
    staged_closure: null,
    policy_update: null,
  };
}

export function appendPendingIntervention(ledger = [], contract) {
  const existing = pendingRecords(ledger);
  if (existing.length > 0) {
    throw new Error(`interventionLedger: unresolved pending intervention ${existing[0].contract_id}`);
  }
  const pending = createPendingIntervention(contract);
  return { ledger: [...clone(ledger), pending], pendingIntervention: pending };
}

export function closePendingIntervention({
  ledger = [],
  learnerTurn = '',
  turnIndex = null,
  observer = observeInterventionOutcome,
  config = {},
} = {}) {
  const pending = pendingRecords(ledger)[0] || null;
  if (!pending) return { ledger: clone(ledger), closedRecord: null, pendingIntervention: null };
  const observation = observer({ pendingIntervention: pending, learnerTurn, turnIndex });
  const staged = maybeStagePartialIntervention({ pending, observation, turnIndex, config });
  if (staged) {
    const nextLedger = ledger.map((record) => (record.contract_id === pending.contract_id ? staged : record));
    return { ledger: nextLedger, closedRecord: null, pendingIntervention: staged };
  }
  const finalObservation = maybePromoteAccumulatedSuccess(pending, observation);
  const successSignal = clone(pending.original_success_signal || pending.success_signal || {});
  const closed = {
    ...clone(pending),
    success_signal: successSignal,
    status: 'closed',
    closed_turn_index: turnIndex,
    observed_transition: finalObservation.observed_transition,
    outcome: finalObservation.outcome,
    evidence: [...(pending.evidence || []), ...(finalObservation.evidence || [])],
    policy_update: inferPolicyUpdate(pending, finalObservation),
  };
  const nextLedger = ledger.map((record) => (record.contract_id === pending.contract_id ? closed : record));
  return { ledger: nextLedger, closedRecord: closed, pendingIntervention: null };
}

function stagedClosureEnabled(config = {}) {
  return config.stagedCombinedClosure === true || config.staged_combined_closure === true;
}

function isCombinedProofResistancePending(pending) {
  const layer = pending?.adaptation_policy_layer || pending?.policy_layer || null;
  return Boolean(layer?.proof_dag?.id && layer?.learner_resistance?.observed_signal);
}

function categoryUnion(evidence = []) {
  const categories = {};
  for (const entry of evidence || []) {
    for (const [label, value] of Object.entries(entry?.categories || {})) {
      categories[label] = categories[label] === true || value === true;
    }
  }
  return categories;
}

function requiredLabels(pending) {
  return pending?.original_success_signal?.required_evidence || pending?.success_signal?.required_evidence || [];
}

function missingRequiredLabels(required = [], categories = {}) {
  return required.filter((label) => categories[label] !== true);
}

function observedRequiredLabels(required = [], categories = {}) {
  return required.filter((label) => categories[label] === true);
}

function mergeObservedTransition(a = {}, b = {}) {
  const out = { ...(a || {}) };
  for (const [axis, value] of Object.entries(b || {})) {
    out[axis] = Math.max(Number(out[axis] || 0), Number(value || 0));
  }
  return out;
}

function maybePromoteAccumulatedSuccess(pending, observation) {
  const evidence = [...(pending.evidence || []), ...(observation.evidence || [])];
  const categories = categoryUnion(evidence);
  const required = requiredLabels(pending);
  const missing = missingRequiredLabels(required, categories);
  if (
    isCombinedProofResistancePending(pending) &&
    missing.length === 0 &&
    observation.forbidden_evidence_present !== true &&
    categories['mere agreement'] !== true
  ) {
    return {
      ...observation,
      outcome: 'success',
      required_evidence_satisfied: true,
      required_evidence_observed: observedRequiredLabels(required, categories),
      required_evidence_missing: [],
    };
  }
  return observation;
}

function maybeStagePartialIntervention({ pending, observation, turnIndex, config }) {
  if (!stagedClosureEnabled(config)) return null;
  if (pending?.action_type !== 'request_evidence') return null;
  if (!isCombinedProofResistancePending(pending)) return null;
  if (observation.outcome !== 'inconclusive') return null;
  if (observation.forbidden_evidence_present === true) return null;

  const previousEvidence = pending.evidence || [];
  const nextEvidence = [...previousEvidence, ...(observation.evidence || [])];
  const previousCategories = categoryUnion(previousEvidence);
  const nextCategories = categoryUnion(nextEvidence);
  if (nextCategories['mere agreement'] === true) return null;

  const required = requiredLabels(pending);
  const previousMissing = missingRequiredLabels(required, previousCategories);
  const nextMissing = missingRequiredLabels(required, nextCategories);
  const observed = observedRequiredLabels(required, nextCategories);
  const madeProgress = nextMissing.length < previousMissing.length;
  if (!madeProgress || nextMissing.length === 0) return null;

  const attempts = Number(pending.staged_closure?.attempts || 0) + 1;
  return {
    ...clone(pending),
    status: 'pending',
    observed_transition: mergeObservedTransition(pending.observed_transition, observation.observed_transition),
    outcome: 'partial',
    evidence: nextEvidence,
    success_signal: {
      ...(pending.success_signal || {}),
      required_evidence: nextMissing,
    },
    staged_closure: {
      version: 'adaptation-staged-combined-closure.v1',
      attempts,
      observed_required_evidence: observed,
      missing_required_evidence: nextMissing,
      last_turn_index: turnIndex,
    },
    policy_update: {
      type: 'continue_combined_contract_for_missing_evidence',
      action_type: pending.action_type,
      hypothesis_ids: pending.hypothesis_ids || [],
      missing_required_evidence: nextMissing,
    },
  };
}

export function inferPolicyUpdate(pending, observation) {
  if (!pending || !observation) return null;
  if (observation.outcome === 'success') {
    return {
      type: 'reinforce_action_under_hypotheses',
      action_type: pending.action_type,
      hypothesis_ids: pending.hypothesis_ids || [],
    };
  }
  if (observation.outcome === 'failure') {
    return {
      type: 'avoid_repetition_without_new_evidence',
      action_type: pending.action_type,
      hypothesis_ids: pending.hypothesis_ids || [],
    };
  }
  return {
    type: 'do_not_treat_state_as_improved',
    action_type: pending.action_type,
    hypothesis_ids: pending.hypothesis_ids || [],
  };
}

export function recentFailures(ledger = [], { hypothesisId = null, actionType = null, limit = 5 } = {}) {
  return ledger
    .filter((record) => record?.status === 'closed' && record.outcome === 'failure')
    .filter((record) => !hypothesisId || (record.hypothesis_ids || []).includes(hypothesisId))
    .filter((record) => !actionType || record.action_type === actionType)
    .slice(-limit);
}

export function hasMateriallyChangedCondition(record, stateBelief) {
  if (!record || !stateBelief) return false;
  const prior = new Set(record.hypothesis_ids || []);
  const current = new Set((stateBelief.hypotheses || []).map((h) => h.id));
  for (const h of current) {
    if (!prior.has(h)) return true;
  }
  const dominant = stateBelief.hypotheses?.[0];
  if (!dominant) return false;
  return !prior.has(dominant.id) || Number(dominant.probability || 0) < 0.45;
}

export function actionRepetitionPenaltyFromLedger(actionType, stateBelief, ledger = [], penalty = 0.5) {
  const dominant = stateBelief?.hypotheses?.[0]?.id;
  if (!dominant) return 0;
  const failures = recentFailures(ledger, { hypothesisId: dominant, actionType });
  if (failures.some((record) => !hasMateriallyChangedCondition(record, stateBelief))) {
    return penalty * failures.length;
  }
  return 0;
}

export function summarizeInterventionLedger(ledger = [], limit = 5) {
  return ledger.slice(-limit).map((record) => ({
    contract_id: record.contract_id,
    turn_index: record.turn_index,
    action_type: record.action_type,
    hypothesis_ids: record.hypothesis_ids,
    status: record.status,
    outcome: record.outcome,
    observed_transition: record.observed_transition,
    policy_update: record.policy_update,
  }));
}
