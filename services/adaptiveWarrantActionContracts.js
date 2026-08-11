/**
 * Typed expected-uptake contracts for adaptive warrant action families.
 *
 * A contract begins after an action family is delivered. The next learner
 * turn is evidence about that action: success may renew the family or require
 * an exit, while defeat/expiry licenses a successor. This module is pure
 * deterministic policy state and is shared by the live gate and offline
 * replay.
 */

import { classifyAdaptiveWarrantPublicSpeechAct } from './adaptiveWarrantPublicObligationLedger.js';

export const ADAPTIVE_WARRANT_ACTION_CONTRACT_SCHEMA = 'machinespirits.adaptation-refinement.action-family-contract.v1';
export const ADAPTIVE_WARRANT_ACTION_CONTRACT_OUTCOME_SCHEMA =
  'machinespirits.adaptation-refinement.action-family-contract-outcome.v1';
export const ADAPTIVE_WARRANT_ACTION_CONTRACT_TRACKER_SCHEMA =
  'machinespirits.adaptation-refinement.action-family-contract-tracker.v1';
export const ADAPTIVE_WARRANT_EVIDENCE_REQUEST_SCHEMA =
  'machinespirits.adaptation-refinement.unresolved-evidence-request.v1';

const CONTRACTS = {
  clarify_term: contract({
    expected: ['uses_or_rephrases_term', 'asks_narrow_followup'],
    deadline: 1,
    success: 'return_prior_or_clarify_distinction',
    defeat: 'repair_explanation',
    expiry: 'repair_explanation',
    exitOnSuccess: true,
  }),
  repair_explanation: contract({
    expected: ['acknowledges_plain_restatement', 'resumes_substantive_inquiry'],
    deadline: 1,
    success: 'return_prior_or_clarify_distinction',
    defeat: 'clarify_term',
    expiry: 'answer_accountably',
    exitOnSuccess: true,
  }),
  clarify_distinction: contract({
    expected: ['states_or_tests_bounded_distinction'],
    deadline: 2,
    success: 'renew',
    defeat: 'ground_in_material',
    expiry: 'ground_in_material',
  }),
  stage_next_step: contract({
    expected: ['adopts_or_uses_staged_evidence', 'asks_one_new_bounded_question'],
    deadline: 2,
    success: 'renew',
    defeat: 'answer_accountably',
    expiry: 'ground_in_material',
  }),
  answer_accountably: contract({
    expected: ['accepts_contests_or_refines_bounded_answer'],
    deadline: 1,
    success: 'stage_next_step',
    defeat: 'clarify_distinction',
    expiry: 'clarify_distinction',
    exitOnSuccess: true,
  }),
  compress_sayback: contract({
    expected: ['states_supported_claim_in_own_words'],
    deadline: 1,
    success: 'stage_next_step',
    defeat: 'clarify_distinction',
    expiry: 'reanchor_public_evidence',
    exitOnSuccess: true,
  }),
  reanchor_lived_stake: contract({
    expected: ['reengages_with_named_stake_or_evidence'],
    deadline: 2,
    success: 'stage_next_step',
    defeat: 'receive_vulnerability',
    expiry: 'ground_in_material',
    exitOnSuccess: true,
  }),
  reanchor_public_evidence: contract({
    expected: ['cites_adopts_or_revises_from_restaged_evidence'],
    deadline: 1,
    success: 'stage_next_step',
    defeat: 'clarify_distinction',
    expiry: 'ground_in_material',
    exitOnSuccess: true,
  }),
  ground_in_material: contract({
    expected: ['examines_or_uses_named_public_material'],
    deadline: 2,
    success: 'stage_next_step',
    defeat: 'clarify_distinction',
    expiry: 'answer_accountably',
    exitOnSuccess: true,
  }),
  challenge_resistance: contract({
    expected: ['makes_agentive_bounded_claim_or_evidence_move'],
    deadline: 2,
    success: 'stage_next_step',
    defeat: 'ground_in_material',
    expiry: 'receive_vulnerability',
    exitOnSuccess: true,
  }),
  receive_vulnerability: contract({
    expected: ['continues_voluntarily_or_asks_bounded_question'],
    deadline: 2,
    success: 'stage_next_step',
    defeat: 'answer_accountably',
    expiry: 'answer_accountably',
    exitOnSuccess: true,
  }),
  close_inquiry: contract({
    expected: ['acknowledges_or_ends_inquiry'],
    deadline: 1,
    success: 'terminal',
    defeat: 'terminal',
    expiry: 'terminal',
    terminal: true,
  }),
  baseline_plain_response: contract({
    expected: ['substantive_response_or_bounded_question'],
    deadline: 2,
    success: 'renew',
    defeat: 'renew',
    expiry: 'renew',
  }),
};

export const ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS = Object.freeze(CONTRACTS);

function contract({
  expected,
  expectedMatch = 'any',
  deadline,
  success,
  defeat,
  expiry,
  exitOnSuccess = false,
  terminal = false,
}) {
  return Object.freeze({
    schema: ADAPTIVE_WARRANT_ACTION_CONTRACT_SCHEMA,
    expected_learner_responses: Object.freeze([...expected]),
    expected_response_match: expectedMatch,
    deadline_turns: deadline,
    success_transition: success,
    defeat_transition: defeat,
    expiry_transition: expiry,
    exit_on_success: exitOnSuccess,
    terminal,
  });
}

export function getAdaptiveWarrantActionContract(actionFamily) {
  const definition = ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS[actionFamily];
  return definition ? structuredClone(definition) : null;
}

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function classificationTurn(classification) {
  return classification?.turn || classification?.classifier || classification || {};
}

const UNRESOLVED_FORM = /\b(?:no|not|none|missing|without|unrecorded|unshown|unproved|yet|still|before)\b/iu;

/** Extract only a concrete, learner-visible request for missing evidence. */
export function classifyAdaptiveWarrantEvidenceRequest({ learnerText = '', classification = null } = {}) {
  const act = classifyAdaptiveWarrantPublicSpeechAct({ learnerText, classification });
  if (!act.creates_obligation) return null;
  return {
    schema: ADAPTIVE_WARRANT_EVIDENCE_REQUEST_SCHEMA,
    request_kind: 'specific_public_result',
    target_kind: act.target.kind,
    signature: act.target.signature,
    explicitly_unresolved: UNRESOLVED_FORM.test(act.surface),
    surface: act.surface,
  };
}

function isEvidenceMove(turn) {
  return (
    ['cites_public_evidence', 'links_evidence_to_rule', 'revises_from_evidence'].includes(turn.evidence_use) ||
    ['evidence_adoption', 'inference'].includes(turn.discourse_move) ||
    (['claim', 'hypothesis', 'metacognitive_reflection'].includes(turn.discourse_move) &&
      ['grounded', 'reflective', 'exploratory'].includes(turn.epistemic_stance))
  );
}

function isAgentiveEvidenceMove(turn) {
  return (
    ['steering', 'self_correcting'].includes(turn.agency) &&
    (isEvidenceMove(turn) || ['claim', 'evidence_adoption', 'inference'].includes(turn.discourse_move))
  );
}

function isRepairSignal(signal, turn) {
  return (
    signal?.primary === 'repair_request' ||
    turn.discourse_move === 'repair_request' ||
    ['plain_language_request', 'plain_simplification_followup'].includes(turn.request_type)
  );
}

function isResistanceSignal(signal, turn) {
  return (
    signal?.primary === 'low_agency_deferral' ||
    ['resistance_or_low_agency', 'answer_seeking_or_overreach'].includes(turn.request_type) ||
    ['answer_seeking', 'affective_signal'].includes(turn.discourse_move) ||
    ['passive', 'complying'].includes(turn.agency)
  );
}

function classifyContractResponse({ family, signal, turn, dagGrowth }) {
  if (family === 'challenge_resistance') {
    if (isAgentiveEvidenceMove(turn)) return { status: 'success', reason: 'agentive_bounded_evidence_move' };
    if (isResistanceSignal(signal, turn)) return { status: 'pending', reason: 'resistance_or_low_agency_persists' };
  }
  if (family === 'repair_explanation' || family === 'clarify_term') {
    if (isRepairSignal(signal, turn)) return { status: 'defeat', reason: 'repair_or_clarification_request_persists' };
    if (oneLine(signal?.surface) && turn.epistemic_stance !== 'confused') {
      return { status: 'success', reason: 'learner_resumed_after_repair' };
    }
  }
  if (['stage_next_step', 'reanchor_public_evidence', 'ground_in_material'].includes(family)) {
    if ((Number.isFinite(dagGrowth) && dagGrowth > 0) || isEvidenceMove(turn)) {
      return { status: 'success', reason: dagGrowth > 0 ? 'learner_record_grew' : 'learner_used_public_evidence' };
    }
  }
  if (family === 'clarify_distinction' && isEvidenceMove(turn)) {
    return { status: 'success', reason: 'learner_tested_or_stated_distinction' };
  }
  if (
    family === 'answer_accountably' &&
    !isRepairSignal(signal, turn) &&
    (isEvidenceMove(turn) || oneLine(signal?.surface))
  ) {
    return { status: 'success', reason: 'learner_received_or_contested_bounded_answer' };
  }
  if (family === 'compress_sayback' && isEvidenceMove(turn)) {
    return { status: 'success', reason: 'learner_restated_supported_claim' };
  }
  if (family === 'reanchor_lived_stake' && !isResistanceSignal(signal, turn) && oneLine(signal?.surface)) {
    return { status: 'success', reason: 'learner_reengaged_after_lived_stake' };
  }
  if (family === 'receive_vulnerability' && !isResistanceSignal(signal, turn) && oneLine(signal?.surface)) {
    return { status: 'success', reason: 'learner_continued_voluntarily' };
  }
  if (family === 'close_inquiry') return { status: 'success', reason: 'terminal_family_delivered' };
  if (family === 'baseline_plain_response' && oneLine(signal?.surface)) {
    return { status: 'success', reason: 'learner_responded' };
  }
  return { status: 'pending', reason: 'expected_uptake_not_yet_observed' };
}

function successorFor(definition, status, fromFamily) {
  const transition =
    status === 'success'
      ? definition.success_transition
      : status === 'defeat'
        ? definition.defeat_transition
        : definition.expiry_transition;
  if (transition === 'return_prior_or_clarify_distinction') {
    return fromFamily && !['clarify_term', 'repair_explanation'].includes(fromFamily)
      ? fromFamily
      : 'clarify_distinction';
  }
  if (['renew', 'terminal'].includes(transition)) return null;
  return transition;
}

/**
 * Stateful tracker used once per decision point. It retains only public,
 * decision-time facts and can therefore be replayed exactly from traces.
 */
export function createAdaptiveWarrantActionContractTracker() {
  let active = null;

  return {
    snapshot() {
      return {
        schema: ADAPTIVE_WARRANT_ACTION_CONTRACT_TRACKER_SCHEMA,
        active: active ? structuredClone(active) : null,
      };
    },

    assess({
      turn,
      actionFamily = null,
      learnerText = '',
      classification = null,
      signal = null,
      dagGrowth = null,
    } = {}) {
      const normalizedTurn = Number(turn);
      const request = classifyAdaptiveWarrantEvidenceRequest({ learnerText, classification });

      const definition = getAdaptiveWarrantActionContract(actionFamily);
      if (!definition || !Number.isFinite(normalizedTurn) || normalizedTurn < 2) {
        return {
          schema: ADAPTIVE_WARRANT_ACTION_CONTRACT_OUTCOME_SCHEMA,
          turn: Number.isFinite(normalizedTurn) ? normalizedTurn : null,
          action_family: actionFamily,
          contract: definition,
          status: 'not_applicable',
          observation: { evidence_request: request ? structuredClone(request) : null },
          transition: null,
        };
      }

      if (active?.action_family !== actionFamily) {
        active = {
          action_family: actionFamily,
          from_family: active?.action_family || null,
          started_turn: normalizedTurn - 1,
          response_count: 0,
          terminal_status: null,
          exit_required: false,
        };
      } else if (active.terminal_status === 'success' && !active.exit_required) {
        active = {
          ...active,
          started_turn: normalizedTurn - 1,
          response_count: 0,
          terminal_status: null,
          exit_required: false,
        };
      }

      active.response_count += 1;
      if (active.exit_required) {
        return outcome({
          turn: normalizedTurn,
          actionFamily,
          definition,
          active,
          status: active.terminal_status,
          reason: 'required_contract_exit_not_taken',
          request,
        });
      }

      const response = classifyContractResponse({
        family: actionFamily,
        signal,
        turn: classificationTurn(classification),
        dagGrowth,
      });
      const status =
        response.status === 'pending' && active.response_count >= definition.deadline_turns
          ? 'expired'
          : response.status;
      const reason =
        status === 'expired' ? `expected_uptake_absent_by_${definition.deadline_turns}_turn_deadline` : response.reason;
      const result = outcome({
        turn: normalizedTurn,
        actionFamily,
        definition,
        active,
        status,
        reason,
        request,
      });
      if (['success', 'defeat', 'expired'].includes(status)) {
        active.terminal_status = status;
        active.exit_required = Boolean(result.transition?.revision_warranted);
      }
      return result;
    },
  };
}

function outcome({ turn, actionFamily, definition, active, status, reason, request }) {
  const recommended = ['success', 'defeat', 'expired'].includes(status)
    ? successorFor(definition, status, active.from_family)
    : null;
  const exitRequired =
    !definition.terminal &&
    ((status === 'success' && definition.exit_on_success) || ['defeat', 'expired'].includes(status)) &&
    recommended !== null;
  const transitionName =
    status === 'success'
      ? definition.success_transition
      : status === 'defeat'
        ? definition.defeat_transition
        : status === 'expired'
          ? definition.expiry_transition
          : null;
  return {
    schema: ADAPTIVE_WARRANT_ACTION_CONTRACT_OUTCOME_SCHEMA,
    turn,
    action_family: actionFamily,
    contract: definition,
    instance: {
      started_turn: active.started_turn,
      response_count: active.response_count,
      from_family: active.from_family,
    },
    status,
    reason,
    observation: {
      evidence_request: request ? structuredClone(request) : null,
    },
    transition: transitionName
      ? {
          type: transitionName,
          revision_warranted: exitRequired,
          recommended_action_family: recommended,
          discharge_prior_trouble: status === 'success',
        }
      : null,
  };
}
