import { createPendingIntervention } from './adaptiveTutor/interventionLedger.js';
import {
  advanceScaffoldLifecycle,
  createScaffoldLifecycle,
  validateScaffoldLifecycle,
} from './adaptiveTutor/scaffoldLifecycle.js';

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function tutorStubTypedActionDecisionFromTurn(turn) {
  const candidates = [
    turn?.typedActionDecision,
    turn?.typed_action_decision,
    turn?.registerSelection?.typed_action_decision,
  ];
  return candidates.find((candidate) => candidate && typeof candidate === 'object' && candidate.contract_id) || null;
}

export function restoreTutorStubTypedActionState(state, turns, events = []) {
  if (!state.typedActions?.enabled) {
    return { enabled: false, restored: false, ledgerRecords: 0, pendingContractId: null, phase: null };
  }
  const lastClear = events.reduce(
    (index, event, candidate) => (event?.type === 'history_clear' ? candidate : index),
    -1,
  );
  const activeEvents = events.slice(lastClear + 1);
  const records = new Map();
  const order = [];
  const decisions = new Map();
  let lifecycle = null;
  const rememberRecord = (record) => {
    const contractId = record?.contract_id;
    if (!contractId) return;
    if (records.get(contractId)?.status === 'closed' && record.status !== 'closed') return;
    if (!records.has(contractId)) order.push(contractId);
    records.set(contractId, jsonClone(record));
  };
  const rememberDecision = (decision, pendingIntervention = null) => {
    const contractId = decision?.contract_id;
    if (!contractId || typeof decision !== 'object') return;
    decisions.set(contractId, jsonClone(decision));
    if (pendingIntervention?.contract_id === contractId) {
      rememberRecord(pendingIntervention);
      return;
    }
    if (!records.has(contractId) && decision.adaptation_contract?.contract_id === contractId) {
      rememberRecord(createPendingIntervention(decision.adaptation_contract));
    }
  };

  for (const event of activeEvents) {
    if (event?.type === 'tutor_typed_action_decision') {
      rememberDecision(event.decision, event.pendingIntervention);
    } else if (event?.type === 'tutor_typed_action_outcome_closed') {
      rememberRecord(event.outcome?.closed_record);
    } else if (event?.type === 'tutor_scaffold_lifecycle_transition' && event.lifecycle) {
      lifecycle = jsonClone(event.lifecycle);
    }
  }
  for (const turn of turns) {
    const decision = tutorStubTypedActionDecisionFromTurn(turn);
    if (decision) rememberDecision(decision);
    const closedRecord =
      turn?.typedActionOutcomeAfterNextLearner?.closed_record || turn?.typedActionPriorOutcome?.closed_record || null;
    if (closedRecord) rememberRecord(closedRecord);
  }

  const ledger = order.map((contractId) => records.get(contractId)).filter(Boolean);
  const pending = ledger.filter((record) => record.status === 'pending');
  if (pending.length > 1) {
    throw new Error(
      `resume typed-action trace has multiple pending interventions: ${pending.map((record) => record.contract_id).join(', ')}`,
    );
  }
  const pendingContractId = pending[0]?.contract_id || null;
  const currentDecision = pendingContractId ? decisions.get(pendingContractId) || null : null;
  if (pendingContractId && !currentDecision) {
    throw new Error(`resume typed-action trace is missing decision provenance for ${pendingContractId}`);
  }

  lifecycle =
    lifecycle ||
    [...turns]
      .reverse()
      .map((turn) => turn?.scaffoldLifecycle || null)
      .find(Boolean) ||
    createScaffoldLifecycle();
  if (pendingContractId && !lifecycle.pending_contract_id && currentDecision) {
    lifecycle = advanceScaffoldLifecycle(createScaffoldLifecycle(), {
      kind: 'typed_action_decision',
      turn: currentDecision.chosen_action?.turn || currentDecision.adaptation_contract?.turn_index || null,
      decision: currentDecision,
    }).lifecycle;
  }
  validateScaffoldLifecycle(lifecycle);
  if (pendingContractId && lifecycle.pending_contract_id !== pendingContractId) {
    throw new Error(
      `resume typed-action lifecycle pending contract ${lifecycle.pending_contract_id || 'none'} does not match ledger ${pendingContractId}`,
    );
  }
  if (!pendingContractId && lifecycle.pending_contract_id) {
    throw new Error(
      `resume typed-action lifecycle has orphaned pending contract ${lifecycle.pending_contract_id} without a ledger record`,
    );
  }
  state.typedActions.ledger = ledger;
  state.typedActions.currentDecision = currentDecision;
  state.typedActions.scaffoldLifecycle = lifecycle;
  return {
    enabled: true,
    restored: Boolean(ledger.length || currentDecision || lifecycle.transition_count),
    ledgerRecords: ledger.length,
    closedRecords: ledger.filter((record) => record.status === 'closed').length,
    pendingContractId,
    currentActionType: currentDecision?.chosen_action?.action_type || null,
    phase: lifecycle.phase,
    lifecycleTransitions: lifecycle.transition_count,
  };
}
