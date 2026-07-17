export const SCAFFOLD_LIFECYCLE_SCHEMA = 'machinespirits.adaptive-tutor.scaffold-lifecycle.v1';
export const SCAFFOLD_LIFECYCLE_TRANSITION_SCHEMA = 'machinespirits.adaptive-tutor.scaffold-lifecycle-transition.v1';

export const SCAFFOLD_LIFECYCLE_PHASES = Object.freeze([
  'diagnose',
  'support',
  'observe_uptake',
  'fade',
  'independent_work',
  'transfer',
  'recover',
]);

const TERMINAL_PHASES = new Set(['transfer', 'recover']);
const MOVE_FAMILIES_BY_PHASE = Object.freeze({
  diagnose: Object.freeze(['diagnose_elicit']),
  support: Object.freeze(['minimal_support', 'explain_model', 'request_self_explanation']),
  observe_uptake: Object.freeze([]),
  fade: Object.freeze(['fade_transfer']),
  independent_work: Object.freeze([]),
  transfer: Object.freeze(['diagnose_elicit']),
  recover: Object.freeze(['diagnose_elicit']),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function phase(value) {
  const normalized = String(value || '').trim();
  if (!SCAFFOLD_LIFECYCLE_PHASES.includes(normalized)) {
    throw new Error(`scaffoldLifecycle: unsupported phase ${JSON.stringify(value)}`);
  }
  return normalized;
}

function eventKind(event) {
  const kind = String(event?.kind || '').trim();
  if (!['typed_action_decision', 'closed_public_outcome'].includes(kind)) {
    throw new Error(`scaffoldLifecycle: unsupported event kind ${JSON.stringify(kind)}`);
  }
  return kind;
}

function decisionDetails(event) {
  const decision = event?.decision;
  const action = decision?.chosen_action;
  if (!action?.action_type || !action?.move_family) {
    throw new Error('scaffoldLifecycle: typed action decision needs chosen_action action_type and move_family');
  }
  return {
    contractId: decision.contract_id || event.contract_id || null,
    actionType: action.action_type,
    moveFamily: action.move_family,
  };
}

function outcomeDetails(event) {
  const envelope = event?.outcome;
  const outcome = envelope?.outcome ?? envelope?.closed_record?.outcome;
  if (!['success', 'failure', 'inconclusive'].includes(outcome)) {
    throw new Error(`scaffoldLifecycle: closed public outcome must be success, failure, or inconclusive`);
  }
  return {
    contractId: envelope?.contract_id || envelope?.closed_record?.contract_id || event.contract_id || null,
    outcome,
  };
}

export function allowedMoveFamiliesForScaffoldPhase(currentPhase) {
  return [...MOVE_FAMILIES_BY_PHASE[phase(currentPhase)]];
}

export function createScaffoldLifecycle({ cycle = 1, maxTransitionsPerCycle = 8 } = {}) {
  const boundedCycle = Number(cycle);
  const boundedMax = Number(maxTransitionsPerCycle);
  if (!Number.isInteger(boundedCycle) || boundedCycle < 1) {
    throw new Error('scaffoldLifecycle: cycle must be a positive integer');
  }
  if (!Number.isInteger(boundedMax) || boundedMax < 6 || boundedMax > 20) {
    throw new Error('scaffoldLifecycle: maxTransitionsPerCycle must be an integer between 6 and 20');
  }
  return {
    schema: SCAFFOLD_LIFECYCLE_SCHEMA,
    version: '1.0',
    phase: 'diagnose',
    cycle: boundedCycle,
    transition_count: 0,
    cycle_transition_count: 0,
    max_transitions_per_cycle: boundedMax,
    pending_contract_id: null,
    pending_action_type: null,
    terminal: false,
    last_transition: null,
  };
}

export function validateScaffoldLifecycle(lifecycle) {
  if (!lifecycle || typeof lifecycle !== 'object') throw new Error('scaffoldLifecycle: lifecycle is required');
  if (lifecycle.schema !== SCAFFOLD_LIFECYCLE_SCHEMA) {
    throw new Error(`scaffoldLifecycle: unsupported schema ${JSON.stringify(lifecycle.schema)}`);
  }
  phase(lifecycle.phase);
  if (!Number.isInteger(lifecycle.cycle) || lifecycle.cycle < 1) {
    throw new Error('scaffoldLifecycle: cycle must be a positive integer');
  }
  if (!Number.isInteger(lifecycle.transition_count) || lifecycle.transition_count < 0) {
    throw new Error('scaffoldLifecycle: transition_count must be a non-negative integer');
  }
  if (!Number.isInteger(lifecycle.cycle_transition_count) || lifecycle.cycle_transition_count < 0) {
    throw new Error('scaffoldLifecycle: cycle_transition_count must be a non-negative integer');
  }
  return lifecycle;
}

function decisionTransition(current, event) {
  const details = decisionDetails(event);
  let from = current.phase;
  let cycle = current.cycle;
  let cycleTransitionCount = current.cycle_transition_count;
  let restarted = false;
  if (TERMINAL_PHASES.has(from)) {
    from = 'diagnose';
    cycle += 1;
    cycleTransitionCount = 0;
    restarted = true;
  }
  if (!details.contractId) {
    return {
      from: current.phase,
      to: 'recover',
      cycle,
      cycleTransitionCount,
      accepted: false,
      reason: 'typed_action_decision_missing_contract_id',
      contractId: null,
      actionType: details.actionType,
      moveFamily: details.moveFamily,
      outcome: null,
    };
  }
  const allowed = allowedMoveFamiliesForScaffoldPhase(from);
  const accepted = allowed.includes(details.moveFamily);
  let to = from;
  let reason = restarted ? `new_cycle_after_${current.phase}` : `${from}_action_pending_public_outcome`;
  if (!accepted) {
    to = 'recover';
    reason = `move_family_${details.moveFamily}_not_allowed_in_${from}`;
  } else if (from === 'support') {
    to = 'observe_uptake';
    reason = 'support_delivered_observe_next_public_uptake';
  } else if (from === 'fade') {
    to = 'independent_work';
    reason = 'support_faded_observe_independent_work';
  }
  return {
    from: current.phase,
    to,
    cycle,
    cycleTransitionCount,
    accepted,
    reason,
    contractId: details.contractId,
    actionType: details.actionType,
    moveFamily: details.moveFamily,
    outcome: null,
  };
}

function outcomeTransition(current, event) {
  const details = outcomeDetails(event);
  if (!current.pending_contract_id) {
    return {
      from: current.phase,
      to: 'recover',
      cycle: current.cycle,
      cycleTransitionCount: current.cycle_transition_count,
      accepted: false,
      reason: 'closed_outcome_without_pending_decision',
      contractId: details.contractId,
      actionType: null,
      moveFamily: null,
      outcome: details.outcome,
    };
  }
  if (!details.contractId) {
    return {
      from: current.phase,
      to: 'recover',
      cycle: current.cycle,
      cycleTransitionCount: current.cycle_transition_count,
      accepted: false,
      reason: 'closed_outcome_missing_contract_id_for_pending_decision',
      contractId: null,
      actionType: current.pending_action_type,
      moveFamily: null,
      outcome: details.outcome,
    };
  }
  if (current.pending_contract_id !== details.contractId) {
    return {
      from: current.phase,
      to: 'recover',
      cycle: current.cycle,
      cycleTransitionCount: current.cycle_transition_count,
      accepted: false,
      reason: 'closed_outcome_contract_mismatch',
      contractId: details.contractId,
      actionType: current.pending_action_type,
      moveFamily: null,
      outcome: details.outcome,
    };
  }
  const rules = {
    diagnose: { success: 'support', failure: 'support', inconclusive: 'support' },
    observe_uptake: { success: 'fade', failure: 'recover', inconclusive: 'recover' },
    independent_work: { success: 'transfer', failure: 'recover', inconclusive: 'recover' },
  };
  const to = rules[current.phase]?.[details.outcome] || 'recover';
  return {
    from: current.phase,
    to,
    cycle: current.cycle,
    cycleTransitionCount: current.cycle_transition_count,
    accepted: Boolean(rules[current.phase]),
    reason:
      current.phase === 'diagnose'
        ? 'diagnostic_outcome_observed_begin_bounded_support'
        : current.phase === 'observe_uptake' && details.outcome === 'success'
          ? 'public_uptake_observed_begin_fade'
          : current.phase === 'independent_work' && details.outcome === 'success'
            ? 'independent_public_success_begin_transfer'
            : `public_${details.outcome}_requires_recovery`,
    contractId: details.contractId,
    actionType: current.pending_action_type,
    moveFamily: null,
    outcome: details.outcome,
  };
}

export function advanceScaffoldLifecycle(lifecycle, event) {
  const current = clone(validateScaffoldLifecycle(clone(lifecycle)));
  const kind = eventKind(event);
  let details =
    kind === 'typed_action_decision' ? decisionTransition(current, event) : outcomeTransition(current, event);
  const nextCycleCount = details.cycleTransitionCount + 1;
  if (nextCycleCount > current.max_transitions_per_cycle && !TERMINAL_PHASES.has(details.to)) {
    details = {
      ...details,
      to: 'recover',
      accepted: false,
      reason: 'max_transitions_per_cycle_exceeded',
    };
  }
  const transition = {
    schema: SCAFFOLD_LIFECYCLE_TRANSITION_SCHEMA,
    version: '1.0',
    sequence: current.transition_count + 1,
    cycle: details.cycle,
    cycle_sequence: nextCycleCount,
    turn: Number(event.turn || 0) || null,
    event_kind: kind,
    from: details.from,
    to: details.to,
    accepted: details.accepted,
    reason: details.reason,
    contract_id: details.contractId,
    action_type: details.actionType,
    move_family: details.moveFamily,
    outcome: details.outcome,
    public_evidence_only: true,
    terminal: TERMINAL_PHASES.has(details.to),
  };
  const next = {
    ...current,
    phase: details.to,
    cycle: details.cycle,
    transition_count: transition.sequence,
    cycle_transition_count: nextCycleCount,
    pending_contract_id: kind === 'typed_action_decision' && details.accepted ? details.contractId : null,
    pending_action_type: kind === 'typed_action_decision' && details.accepted ? details.actionType : null,
    terminal: transition.terminal,
    last_transition: transition,
  };
  return { lifecycle: validateScaffoldLifecycle(next), transition };
}
