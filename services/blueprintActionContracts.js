/**
 * blueprintActionContracts — per-turn typed action-contract middleware for the
 * standard-runner id-director path (blueprint composition, cells 199-200).
 *
 * Extracts the Plan 2.x select→contract→verify→close cycle from the LangGraph
 * adaptive runner (services/adaptiveTutor/) as pure per-turn calls, following
 * the resistanceSignalGate.js precedent. The LangGraph nodes are thin closures
 * over pure functions (actionPolicy.selectPedagogicalAction,
 * adaptationContract.createAdaptationContract, interventionLedger.*,
 * realizationVerifier.verifyRealization); this module carries the same state
 * as a plain object threaded through the dialogue trace.
 *
 * Deliberate exclusions (recorded in config/tutor-blueprint.yaml):
 *  - validateProofReleaseOwnershipGate is NOT ported — it requires
 *    machine-checkable proof state that suggestion/resistance scenarios lack.
 *    Every contract here carries the default allowed gate result.
 *  - repairRealization is NOT applied — realization checks are recorded in
 *    the trace for analysis, never used to mutate the tutor's message. The
 *    blueprint claim discipline requires observation before enforcement.
 */

import { estimateLearnerStateBelief, selectPedagogicalAction } from './adaptiveTutor/actionPolicy.js';
import { createAdaptationContract, updateContractRealizationChecks } from './adaptiveTutor/adaptationContract.js';
import { appendPendingIntervention, closePendingIntervention } from './adaptiveTutor/interventionLedger.js';
import { verifyRealization } from './adaptiveTutor/realizationVerifier.js';

export const BLUEPRINT_CONTRACT_TRACE_ROLE = 'action_contract';

function toDialogueRole(role) {
  const lower = String(role || '').toLowerCase();
  if (lower === 'assistant' || lower === 'tutor') return 'tutor';
  return 'learner';
}

/**
 * Map an id-director history array ({role, content} with user/assistant or
 * learner/tutor roles) plus the current learner message into the
 * {role: 'learner'|'tutor', content} dialogue shape actionPolicy expects.
 */
export function buildContractDialogue(history, learnerMessage) {
  const dialogue = (Array.isArray(history) ? history : [])
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: toDialogueRole(m.role), content: m.content }));
  if (typeof learnerMessage === 'string' && learnerMessage.trim()) {
    dialogue.push({ role: 'learner', content: learnerMessage });
  }
  return dialogue;
}

function parseDetail(detail) {
  if (detail && typeof detail === 'object') return detail;
  if (typeof detail === 'string') {
    try {
      return JSON.parse(detail);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Recover the intervention ledger persisted by a previous turn's trace entry.
 * Tolerant of both persistence shapes: the interaction-engine path's
 * internalDeliberation entries ({role, state}) and the runner-adapter path's
 * dialogue trace entries ({agent, action, detail: JSON string}). Mirrors
 * extractEngagementRegisterHistory's shape tolerance.
 */
export function extractContractLedger(traceLike) {
  const entries = Array.isArray(traceLike)
    ? traceLike
    : Array.isArray(traceLike?.dialogueTrace)
      ? traceLike.dialogueTrace
      : Array.isArray(traceLike?.consolidatedTrace)
        ? traceLike.consolidatedTrace
        : Array.isArray(traceLike?.turns)
          ? traceLike.turns.flatMap((turn) => turn?.internalDeliberation || [])
          : [];
  let ledger = [];
  for (const entry of entries) {
    const isContractEntry =
      entry?.role === BLUEPRINT_CONTRACT_TRACE_ROLE || entry?.agent === BLUEPRINT_CONTRACT_TRACE_ROLE;
    if (!isContractEntry) continue;
    const payload = entry?.state && typeof entry.state === 'object' ? entry.state : parseDetail(entry?.detail);
    if (Array.isArray(payload?.ledger)) ledger = payload.ledger;
  }
  return ledger;
}

/**
 * Compact single-line rendering of the selected action for the id prompt.
 * Strips scoring internals; keeps what the id needs to realize the action.
 */
export function buildContractPromptBlock(contract) {
  if (!contract?.selected_action) return '';
  const action = contract.selected_action;
  const visible = {
    action_type: action.action_type,
    expected_transition: action.expected_transition || null,
    success_signal: action.success_signal || null,
  };
  return [
    '<adaptation_contract>',
    JSON.stringify(visible, null, 2),
    'The generated_prompt must direct the ego to realize this pedagogical action',
    'this turn. Do not name the action to the learner; enact it. The action is a',
    'move constraint, not a register constraint — persona and register selection',
    'remain governed by the other directives.',
    '</adaptation_contract>',
  ].join('\n');
}

/**
 * Pre-ego step. Closes the previous pending intervention against the new
 * learner turn, re-estimates the learner-state belief, selects a pedagogical
 * action, and issues the turn's adaptation contract.
 */
export function prepareBlueprintContractTurn({
  learnerMessage = '',
  history = [],
  priorLedger = [],
  turnIndex = 0,
  dialogueId = 'blueprint',
  config = {},
} = {}) {
  const dialogue = buildContractDialogue(history, learnerMessage);
  const closed = closePendingIntervention({
    ledger: priorLedger,
    learnerTurn: learnerMessage,
    turnIndex,
    config,
  });
  const stateBelief = estimateLearnerStateBelief({
    dialogue,
    interventionLedger: closed.ledger,
    turnIndex,
    config,
  });
  const policy = selectPedagogicalAction({
    stateBelief,
    interventionLedger: closed.ledger,
    mode: 'closed_loop',
    config,
  });
  const contract = createAdaptationContract({
    contractId: `blueprint-${dialogueId}-turn-${turnIndex}`,
    dialogueId,
    turnIndex,
    stateBelief,
    selectedAction: policy.selectedAction,
    candidateActions: policy.candidateActions || [],
    gateResult: { allowed: true, violations: [], repairs: [] },
    realizationChecks: { action_consistent: null, forbidden_move_detected: null },
    policyMode: 'closed_loop',
    worldAdaptationSpec: null,
  });
  return {
    ledger: closed.ledger,
    closedRecord: closed.closedRecord,
    stateBelief,
    selectedAction: contract.selected_action,
    candidateActions: policy.candidateActions || [],
    contract,
    promptBlock: buildContractPromptBlock(contract),
  };
}

/**
 * Post-ego step. Verifies (but never repairs) the realized tutor text against
 * the contract, stamps the realization checks onto the contract, and opens the
 * pending intervention the next learner turn will close.
 */
export function finalizeBlueprintContractTurn({ contract, ledger = [], tutorText = '' } = {}) {
  const realization = verifyRealization({ tutorText, selectedAction: contract?.selected_action });
  const stamped = updateContractRealizationChecks(contract, {
    action_consistent: realization.action_consistent,
    forbidden_move_detected: realization.forbidden_move_detected,
  });
  const appended = appendPendingIntervention(ledger, stamped);
  return {
    contract: stamped,
    ledger: appended.ledger,
    pendingIntervention: appended.pendingIntervention,
    realization,
  };
}

/**
 * The trace payload persisted each turn. Next turn's extractContractLedger
 * reads `ledger` back; the rest is analysis surface.
 */
export function buildContractTracePayload({ contract, ledger, closedRecord, realization }) {
  return {
    contract_id: contract?.contract_id || null,
    action_type: contract?.selected_action?.action_type || null,
    gate_allowed: contract?.gate_result?.allowed ?? null,
    realization: realization || null,
    closed_record: closedRecord
      ? { contract_id: closedRecord.contract_id, outcome: closedRecord.outcome, status: closedRecord.status }
      : null,
    ledger,
  };
}
