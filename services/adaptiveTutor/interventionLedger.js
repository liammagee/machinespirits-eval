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
    status: 'pending',
    observed_transition: null,
    outcome: null,
    evidence: [],
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

export function closePendingIntervention({ ledger = [], learnerTurn = '', turnIndex = null, observer = observeInterventionOutcome } = {}) {
  const pending = pendingRecords(ledger)[0] || null;
  if (!pending) return { ledger: clone(ledger), closedRecord: null, pendingIntervention: null };
  const observation = observer({ pendingIntervention: pending, learnerTurn, turnIndex });
  const closed = {
    ...clone(pending),
    status: 'closed',
    closed_turn_index: turnIndex,
    observed_transition: observation.observed_transition,
    outcome: observation.outcome,
    evidence: observation.evidence || [],
    policy_update: inferPolicyUpdate(pending, observation),
  };
  const nextLedger = ledger.map((record) => (record.contract_id === pending.contract_id ? closed : record));
  return { ledger: nextLedger, closedRecord: closed, pendingIntervention: null };
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
