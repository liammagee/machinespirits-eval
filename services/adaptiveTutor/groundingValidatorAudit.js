// Structural audit helpers for the A14 evidence-ledger grounding validator.
//
// Historical cell-127/128 traces persist end-of-turn hypothesis snapshots, but
// not the validator's raw {hypothesis_id, new_status, reasoning} proposals. A
// dropped unknown id therefore leaves no trace and its legacy rate is not
// identifiable. These helpers make every future validator call and decision
// explicit in adaptationTrace without changing which hypothesis updates apply.

export const GROUNDING_VALIDATOR_CALL_AUDIT = 'grounding_validator_call_audit';
export const GROUNDING_VALIDATOR_DECISION_AUDIT = 'grounding_validator_decision_audit';

const TERMINAL_STATUSES = new Set(['validated', 'contradicted']);
const OBS_ID_PATTERN = /\bt\d+_\d+_[a-z0-9]+\b/giu;

function uniqueStrings(values) {
  return [...new Set((values || []).filter((value) => typeof value === 'string' && value.length > 0))];
}

export function extractGroundingEvidenceCitations(reasoning) {
  return uniqueStrings(String(reasoning || '').match(OBS_ID_PATTERN) || []);
}

function thresholdAudit(hypothesis, newStatus) {
  if (!hypothesis || !TERMINAL_STATUSES.has(newStatus)) {
    return { met: false, supportCount: null, contradictCount: null, confidence: null };
  }

  const supportCount = uniqueStrings(hypothesis.supporting_evidence).length;
  const contradictCount = uniqueStrings(hypothesis.contradicting_evidence).length;
  const confidence = typeof hypothesis.confidence === 'number' ? hypothesis.confidence : 0.5;
  const met =
    newStatus === 'validated'
      ? supportCount >= 3 && contradictCount === 0 && confidence >= 0.6
      : contradictCount >= 1 && confidence < 0.4;

  return { met, supportCount, contradictCount, confidence };
}

function auditDecision({ decision, decisionIndex, tentativeById, evidenceIds, turn }) {
  const hypothesisId = typeof decision?.hypothesis_id === 'string' ? decision.hypothesis_id : '';
  const newStatus = typeof decision?.new_status === 'string' ? decision.new_status : '';
  const hypothesis = tentativeById.get(hypothesisId) || null;
  const statusAllowed = TERMINAL_STATUSES.has(newStatus);
  const citedEvidenceIds = extractGroundingEvidenceCitations(decision?.reasoning);
  const missingCitedEvidenceIds = citedEvidenceIds.filter((id) => !evidenceIds.has(id));
  const relevantEvidenceIds = hypothesis
    ? uniqueStrings(newStatus === 'validated' ? hypothesis.supporting_evidence : hypothesis.contradicting_evidence)
    : [];
  const relevantEvidenceSet = new Set(relevantEvidenceIds);
  const citedOutsideHypothesisIds = citedEvidenceIds.filter((id) => !relevantEvidenceSet.has(id));
  const missingHypothesisEvidenceIds = relevantEvidenceIds.filter((id) => !evidenceIds.has(id));
  const threshold = thresholdAudit(hypothesis, newStatus);

  let dropReason = null;
  if (!hypothesis) dropReason = 'unknown_hypothesis_id';
  else if (!statusAllowed) dropReason = 'invalid_new_status';

  const applied = dropReason == null;
  const structurallyGrounded =
    applied &&
    threshold.met &&
    citedEvidenceIds.length > 0 &&
    missingCitedEvidenceIds.length === 0 &&
    citedOutsideHypothesisIds.length === 0 &&
    missingHypothesisEvidenceIds.length === 0;

  const payload = {
    decision_index: decisionIndex,
    hypothesis_id: hypothesisId,
    new_status: newStatus,
    reasoning: typeof decision?.reasoning === 'string' ? decision.reasoning : '',
    applied,
    drop_reason: dropReason,
    cited_evidence_ids: citedEvidenceIds,
    missing_cited_evidence_ids: missingCitedEvidenceIds,
    cited_outside_hypothesis_ids: citedOutsideHypothesisIds,
    hypothesis_evidence_ids: relevantEvidenceIds,
    missing_hypothesis_evidence_ids: missingHypothesisEvidenceIds,
    threshold_met: threshold.met,
    threshold_support_count: threshold.supportCount,
    threshold_contradict_count: threshold.contradictCount,
    threshold_confidence: threshold.confidence,
    structurally_grounded: structurallyGrounded,
  };

  return {
    update: applied ? { ...hypothesis, status: newStatus } : null,
    event: { type: GROUNDING_VALIDATOR_DECISION_AUDIT, turn, payload },
  };
}

export function evaluateGroundingValidatorDecisions({ decisions, tentativeHypotheses, validatedEvidence, turn }) {
  const tentative = Array.isArray(tentativeHypotheses) ? tentativeHypotheses : [];
  const proposed = Array.isArray(decisions) ? decisions : [];
  const tentativeById = new Map(tentative.map((hypothesis) => [hypothesis.hypothesis_id, hypothesis]));
  const evidenceIds = new Set(
    (Array.isArray(validatedEvidence) ? validatedEvidence : [])
      .filter((entry) => entry?.validated !== false)
      .map((entry) => entry?.obs_id)
      .filter(Boolean),
  );
  const audited = proposed.map((decision, decisionIndex) =>
    auditDecision({ decision, decisionIndex, tentativeById, evidenceIds, turn }),
  );
  const decisionEvents = audited.map((entry) => entry.event);
  const appliedUpdates = audited.map((entry) => entry.update).filter(Boolean);
  const payloads = decisionEvents.map((event) => event.payload);
  const callEvent = {
    type: GROUNDING_VALIDATOR_CALL_AUDIT,
    turn,
    payload: {
      skipped_reason: tentative.length === 0 ? 'no_tentative_hypotheses' : null,
      tentative_hypothesis_count: tentative.length,
      validated_evidence_count: evidenceIds.size,
      decision_count: proposed.length,
      applied_count: payloads.filter((payload) => payload.applied).length,
      dropped_count: payloads.filter((payload) => !payload.applied).length,
      structurally_grounded_count: payloads.filter((payload) => payload.structurally_grounded).length,
    },
  };

  return { appliedUpdates, auditEvents: [callEvent, ...decisionEvents] };
}

function branchAuditEvents(branch) {
  const finalEvents = Array.isArray(branch?.finalAdaptationTrace) ? branch.finalAdaptationTrace : [];
  const perTurnEvents = Array.isArray(branch?.perTurn)
    ? branch.perTurn.flatMap((record) => (Array.isArray(record?.adaptationTrace) ? record.adaptationTrace : []))
    : [];
  const candidates = finalEvents.length > 0 ? finalEvents : perTurnEvents;
  return candidates.filter(
    (event) => event?.type === GROUNDING_VALIDATOR_CALL_AUDIT || event?.type === GROUNDING_VALIDATOR_DECISION_AUDIT,
  );
}

export function observableGroundingTerminalEvents(branch) {
  const records = Array.isArray(branch?.perTurn) ? [...branch.perTurn].sort((a, b) => a.turn - b.turn) : [];
  let previousById = new Map();
  const transitions = [];

  for (const record of records) {
    const hypotheses = Array.isArray(record?.hypotheses) ? record.hypotheses : [];
    const evidenceIds = new Set(
      (Array.isArray(record?.evidenceLog) ? record.evidenceLog : [])
        .filter((entry) => entry?.validated !== false)
        .map((entry) => entry?.obs_id)
        .filter(Boolean),
    );
    const currentById = new Map(hypotheses.map((hypothesis) => [hypothesis.hypothesis_id, hypothesis]));

    for (const hypothesis of hypotheses) {
      const priorStatus = previousById.get(hypothesis.hypothesis_id)?.status ?? null;
      if (!TERMINAL_STATUSES.has(hypothesis.status) || priorStatus === hypothesis.status) continue;
      const relevantEvidenceIds = uniqueStrings(
        hypothesis.status === 'validated' ? hypothesis.supporting_evidence : hypothesis.contradicting_evidence,
      );
      const missingEvidenceIds = relevantEvidenceIds.filter((id) => !evidenceIds.has(id));
      const threshold = thresholdAudit(hypothesis, hypothesis.status);
      transitions.push({
        turn: record.turn,
        hypothesis_id: hypothesis.hypothesis_id,
        from_status: priorStatus,
        to_status: hypothesis.status,
        hypothesis_evidence_ids: relevantEvidenceIds,
        missing_hypothesis_evidence_ids: missingEvidenceIds,
        threshold_met: threshold.met,
        threshold_support_count: threshold.supportCount,
        threshold_contradict_count: threshold.contradictCount,
        threshold_confidence: threshold.confidence,
        structurally_grounded_snapshot:
          threshold.met && relevantEvidenceIds.length > 0 && missingEvidenceIds.length === 0,
        attribution: 'unidentifiable_between_hypothesis_updater_and_grounding_validator',
      });
    }
    previousById = currentById;
  }

  return transitions;
}

export function auditGroundingValidatorTrace(trace, metadata = {}) {
  const branches = [
    ['original', trace?.original],
    ['counterfactual', trace?.counterfactual],
  ].filter(([, branch]) => branch);

  return branches.map(([branchName, branch]) => {
    const events = branchAuditEvents(branch);
    const callEvents = events.filter((event) => event.type === GROUNDING_VALIDATOR_CALL_AUDIT);
    const decisionEvents = events.filter((event) => event.type === GROUNDING_VALIDATOR_DECISION_AUDIT);
    return {
      ...metadata,
      branch: branchName,
      instrumented: callEvents.length > 0,
      call_events: callEvents,
      decision_events: decisionEvents,
      observable_terminal_events: observableGroundingTerminalEvents(branch),
    };
  });
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

export function summarizeGroundingValidatorBranches(branches) {
  const rows = Array.isArray(branches) ? branches : [];
  const instrumented = rows.filter((row) => row.instrumented);
  const decisionEvents = instrumented.flatMap((row) => row.decision_events || []);
  const decisions = decisionEvents.map((event) => event.payload || {});
  const dropped = decisions.filter((decision) => !decision.applied);
  const grounded = decisions.filter((decision) => decision.structurally_grounded);
  const terminalEvents = rows.flatMap((row) => row.observable_terminal_events || []);

  return {
    trace_branches: rows.length,
    instrumented_branches: instrumented.length,
    exact_decision_coverage: ratio(instrumented.length, rows.length),
    validator_calls_observed: instrumented.reduce((sum, row) => sum + (row.call_events || []).length, 0),
    raw_decisions_observed: decisions.length,
    applied_decisions: decisions.length - dropped.length,
    dropped_decisions: dropped.length,
    silent_drop_rate: instrumented.length === rows.length ? ratio(dropped.length, decisions.length) : null,
    structurally_grounded_decisions: grounded.length,
    structurally_grounded_decision_rate:
      instrumented.length === rows.length ? ratio(grounded.length, decisions.length) : null,
    drop_reasons: dropped.reduce((counts, decision) => {
      const reason = decision.drop_reason || 'unknown';
      counts[reason] = (counts[reason] || 0) + 1;
      return counts;
    }, {}),
    observed_terminal_events: terminalEvents.length,
    first_observed_terminal_appearances: terminalEvents.filter((event) => event.from_status == null).length,
    within_trace_terminal_transitions: terminalEvents.filter((event) => event.from_status != null).length,
    structurally_grounded_observed_terminal_events: terminalEvents.filter(
      (event) => event.structurally_grounded_snapshot,
    ).length,
    observed_terminal_event_grounding_rate: ratio(
      terminalEvents.filter((event) => event.structurally_grounded_snapshot).length,
      terminalEvents.length,
    ),
    legacy_identifiability:
      instrumented.length === rows.length
        ? 'exact_raw_decisions_observed'
        : 'silent_drop_rate_unidentifiable_raw_validator_proposals_not_persisted',
  };
}
