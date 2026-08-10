/**
 * Shared normative/descriptive divergence projection for the adaptive warrant
 * architecture. The projection is deterministic and decision-time only: it
 * names the public norm, the observed public state, and the distance between
 * them without deciding the successor action family.
 */

export const ADAPTIVE_WARRANT_DIVERGENCE_SCHEMA =
  'machinespirits.adaptation-refinement.normative-descriptive-divergence.v1';

export const ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS = Object.freeze([
  'conceptual',
  'interactional',
  'engagement',
  'pacing',
  'epistemic',
  'strategy_exhaustion',
]);

export const ADAPTIVE_WARRANT_DIVERGENCE_INTERPRETATIONS = Object.freeze([
  'aligned',
  'productive',
  'stalled',
  'unsafe',
]);

export const ADAPTIVE_WARRANT_DIVERGENCE_MAGNITUDES = Object.freeze([
  'none',
  'low',
  'moderate',
  'high',
]);

function row(dimension, {
  normativeState,
  descriptiveState,
  magnitude = 'none',
  persistence = 0,
  interpretation = 'aligned',
  repairWarranted = false,
  evidence = [],
} = {}) {
  return {
    schema: ADAPTIVE_WARRANT_DIVERGENCE_SCHEMA,
    dimension,
    normative_state: normativeState,
    descriptive_state: descriptiveState,
    magnitude,
    persistence: Math.max(0, Number(persistence) || 0),
    interpretation,
    repair_warranted: Boolean(repairWarranted),
    evidence: [...new Set(evidence.filter(Boolean).map(String))],
  };
}

function magnitudeForCount(count, { moderate = 2, high = 4 } = {}) {
  if (count <= 0) return 'none';
  if (count >= high) return 'high';
  if (count >= moderate) return 'moderate';
  return 'low';
}

function classificationTurn(classification) {
  return classification?.turn || classification?.classifier || classification || {};
}

function obligationAge(publicObligation, turn) {
  const blocking = publicObligation?.blocking_obligation;
  const created = Number(blocking?.created_turn);
  const current = Number(turn);
  if (!blocking) return 0;
  return Number.isFinite(created) && Number.isFinite(current) ? Math.max(1, current - created + 1) : 1;
}

function conceptualRow({ dagGrowth, turnsSinceDagGrowth, signal }) {
  const flatTurns = Math.max(0, Number(turnsSinceDagGrowth) || 0);
  if (Number(dagGrowth) > 0) {
    return row('conceptual', {
      normativeState: 'learner_record_progress_or_explicit_analytic_work',
      descriptiveState: 'learner_record_grew',
      evidence: [`dag_growth:${Number(dagGrowth)}`],
    });
  }
  if (!flatTurns) {
    return row('conceptual', {
      normativeState: 'learner_record_progress_or_explicit_analytic_work',
      descriptiveState: 'no_comparable_prior_record',
    });
  }
  const analytic = signal?.primary === 'engaged_analytic';
  if (analytic) {
    return row('conceptual', {
      normativeState: 'learner_record_progress_or_explicit_analytic_work',
      descriptiveState: 'explicit_analytic_work_without_new_record_entry',
      evidence: [`turns_since_dag_growth:${flatTurns}`, 'learner_signal:engaged_analytic'],
    });
  }
  const stalled = ['stall', 'low_agency_deferral'].includes(signal?.primary);
  if (!stalled) {
    return row('conceptual', {
      normativeState: 'learner_record_progress_or_explicit_analytic_work',
      descriptiveState: 'flat_record_without_public_conceptual_failure',
      evidence: [`turns_since_dag_growth:${flatTurns}`, `learner_signal:${signal?.primary || 'absent'}`],
    });
  }
  return row('conceptual', {
    normativeState: 'learner_record_progress_or_explicit_analytic_work',
    descriptiveState: 'flat_learner_record_with_public_stall_signal',
    magnitude: magnitudeForCount(flatTurns),
    persistence: flatTurns,
    interpretation: 'stalled',
    repairWarranted: flatTurns >= 2,
    evidence: [`turns_since_dag_growth:${flatTurns}`, `learner_signal:${signal?.primary || 'absent'}`],
  });
}

function interactionalRow({ troubleTurns, complaintTurns, publicObligation, turn }) {
  const interactionalTrouble = (troubleTurns || []).filter((entry) =>
    (entry?.defeaters || []).some(
      (item) =>
        item === 'uptake_audit_issues' ||
        item.startsWith('repetition:') ||
        item === 'tutor_response_fallback' ||
        item === 'tutor_response_mechanical_repair' ||
        item === 'tutor_response_guard_exhausted',
    ),
  );
  const blockingCandidate = publicObligation?.blocking_obligation || null;
  const blockingCreatedTurn = Number(blockingCandidate?.created_turn);
  const currentTurn = Number(turn);
  const blocking =
    blockingCandidate &&
    (['overdue', 'reactivated'].includes(blockingCandidate.status) ||
      (Number.isFinite(blockingCreatedTurn) && Number.isFinite(currentTurn) && blockingCreatedTurn < currentTurn))
      ? blockingCandidate
      : null;
  const age = blocking ? obligationAge({ blocking_obligation: blocking }, turn) : 0;
  const persistence = Math.max(interactionalTrouble.length, Number(complaintTurns?.length || 0), age);
  if (!persistence) {
    return row('interactional', {
      normativeState: 'clean_uptake_or_explicitly_resolved_public_trouble',
      descriptiveState: 'no_unresolved_public_interactional_trouble',
    });
  }
  const evidence = interactionalTrouble.map((entry) => `trouble_turn:${entry.turn}`);
  if (complaintTurns?.length) evidence.push(`register_complaints:${complaintTurns.length}`);
  if (blocking) evidence.push(`blocking_obligation:${blocking.status}:${blocking.id}`);
  return row('interactional', {
    normativeState: 'clean_uptake_or_explicitly_resolved_public_trouble',
    descriptiveState: blocking
      ? `unresolved_tutor_public_obligation:${blocking.status}`
      : 'uptake_repetition_or_register_trouble',
    magnitude: magnitudeForCount(persistence),
    persistence,
    interpretation: 'stalled',
    repairWarranted: Boolean(blocking) || interactionalTrouble.length >= 2 || Number(complaintTurns?.length || 0) >= 2,
    evidence,
  });
}

function engagementRow({ signal, classification, deferenceSustained, recentSignals }) {
  const turn = classificationTurn(classification);
  const lowAgency =
    signal?.primary === 'low_agency_deferral' ||
    ['passive', 'complying'].includes(turn.agency) ||
    ['resistance_or_low_agency', 'answer_seeking_or_overreach'].includes(turn.request_type);
  const analytic = signal?.primary === 'engaged_analytic' || ['steering', 'self_correcting'].includes(turn.agency);
  const deferenceCount = (recentSignals || []).filter((entry) => entry?.labels?.includes('low_agency_deferral')).length;
  if (analytic) {
    return row('engagement', {
      normativeState: 'voluntary_agentive_participation',
      descriptiveState: 'agentive_or_analytic_participation',
      evidence: [`learner_signal:${signal?.primary || 'neutral'}`, turn.agency ? `agency:${turn.agency}` : null],
    });
  }
  if (!lowAgency) {
    return row('engagement', {
      normativeState: 'voluntary_agentive_participation',
      descriptiveState: 'no_public_engagement_divergence',
    });
  }
  const persistence = deferenceSustained ? Math.max(3, deferenceCount) : Math.max(1, deferenceCount);
  return row('engagement', {
    normativeState: 'voluntary_agentive_participation',
    descriptiveState: deferenceSustained ? 'sustained_low_agency_deferral' : 'current_low_agency_or_resistance',
    magnitude: deferenceSustained ? 'high' : 'low',
    persistence,
    interpretation: 'stalled',
    repairWarranted: deferenceSustained,
    evidence: [`learner_signal:${signal?.primary || 'neutral'}`, turn.agency ? `agency:${turn.agency}` : null],
  });
}

function pacingRow({ pacingSignal }) {
  const direction = pacingSignal?.direction || 'steady';
  if (direction === 'steady') {
    return row('pacing', {
      normativeState: 'authored_pace_adjusted_only_by_public_learner_evidence',
      descriptiveState: 'no_current_request_to_change_pace',
    });
  }
  const strength = Number(pacingSignal?.strength || 0);
  return row('pacing', {
    normativeState: 'authored_pace_adjusted_only_by_public_learner_evidence',
    descriptiveState: `learner_requests_or_supports_${direction}`,
    magnitude: strength >= 0.8 ? 'moderate' : 'low',
    persistence: 1,
    interpretation: 'productive',
    repairWarranted: true,
    evidence: [`pacing_direction:${direction}`, `pacing_source:${pacingSignal?.source || 'unknown'}`],
  });
}

function epistemicRow({ inquiryCompletion, proposedActionFamily }) {
  const checks = inquiryCompletion?.checks || {};
  const unsupported = Number(checks.unsupported_assertion_count || 0);
  const dropped = Number(checks.active_dropped_fact_count || 0);
  const unintegrated = checks.released_evidence_integrated === false;
  const prematureClosure =
    proposedActionFamily === 'close_inquiry' && inquiryCompletion && inquiryCompletion.status !== 'complete';
  const count = unsupported + dropped + Number(unintegrated) + Number(prematureClosure);
  if (!count) {
    return row('epistemic', {
      normativeState: 'claims_supported_by_public_evidence_with_proof_limits_preserved',
      descriptiveState: 'no_public_epistemic_conflict_detected',
    });
  }
  const unsafe = unsupported > 0 || prematureClosure;
  return row('epistemic', {
    normativeState: 'claims_supported_by_public_evidence_with_proof_limits_preserved',
    descriptiveState: unsafe
      ? 'unsupported_assertion_or_premature_terminal_claim'
      : 'released_evidence_unintegrated_or_dropped',
    magnitude: unsafe ? (count >= 2 ? 'high' : 'moderate') : magnitudeForCount(count),
    persistence: count,
    interpretation: unsafe ? 'unsafe' : 'stalled',
    repairWarranted: true,
    evidence: [
      unsupported ? `unsupported_assertions:${unsupported}` : null,
      dropped ? `active_dropped_facts:${dropped}` : null,
      unintegrated ? 'released_evidence_not_integrated' : null,
      prematureClosure ? 'premature_close_candidate' : null,
    ],
  });
}

function strategyExhaustionRow({ actionContract, troubleTurns }) {
  const status = actionContract?.status || 'not_applicable';
  const responseCount = Number(actionContract?.instance?.response_count || 0);
  const terminalDefeat = ['defeat', 'expired'].includes(status);
  const exitNotTaken = actionContract?.reason === 'required_contract_exit_not_taken';
  const accumulatedTrouble = Number(troubleTurns?.length || 0);
  const exhausted = terminalDefeat || exitNotTaken || accumulatedTrouble >= 2;
  if (!exhausted) {
    return row('strategy_exhaustion', {
      normativeState: 'held_strategy_retained_only_while_expected_uptake_contract_remains_live',
      descriptiveState:
        status === 'success' ? 'expected_uptake_observed' : `contract_${status || 'not_applicable'}`,
      evidence: status === 'success' ? [`contract_status:${status}`] : [],
    });
  }
  const persistence = Math.max(responseCount, accumulatedTrouble, 1);
  return row('strategy_exhaustion', {
    normativeState: 'held_strategy_retained_only_while_expected_uptake_contract_remains_live',
    descriptiveState: exitNotTaken ? 'required_contract_exit_not_taken' : `strategy_${status || 'trouble_accumulated'}`,
    magnitude: exitNotTaken || persistence >= 4 ? 'high' : 'moderate',
    persistence,
    interpretation: 'stalled',
    repairWarranted: true,
    evidence: [`contract_status:${status}`, `contract_responses:${responseCount}`, `trouble_turns:${accumulatedTrouble}`],
  });
}

/** Return exactly one ordered row for every architecture dimension. */
export function projectAdaptiveWarrantDivergence({
  turn = null,
  dagGrowth = null,
  turnsSinceDagGrowth = 0,
  signal = null,
  classification = null,
  recentSignals = [],
  troubleTurns = [],
  complaintTurns = [],
  deferenceSustained = false,
  pacingSignal = null,
  actionContract = null,
  publicObligation = null,
  inquiryCompletion = null,
  proposedActionFamily = null,
} = {}) {
  return [
    conceptualRow({ dagGrowth, turnsSinceDagGrowth, signal }),
    interactionalRow({ troubleTurns, complaintTurns, publicObligation, turn }),
    engagementRow({ signal, classification, deferenceSustained, recentSignals }),
    pacingRow({ pacingSignal }),
    epistemicRow({ inquiryCompletion, proposedActionFamily }),
    strategyExhaustionRow({ actionContract, troubleTurns }),
  ];
}
