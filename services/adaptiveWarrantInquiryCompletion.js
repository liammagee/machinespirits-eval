/**
 * Deterministic inquiry-completion projection for the adaptive warrant gate.
 *
 * This does not invent a second closure policy. It projects the existing
 * learner-DAG, authored-release, and dialogue-closure semantics into a typed
 * decision object that can be compared identically live and offline.
 */

export const ADAPTIVE_WARRANT_EVIDENCE_AVAILABILITY_SCHEMA =
  'machinespirits.adaptation-refinement.evidence-availability.v1';
export const ADAPTIVE_WARRANT_INQUIRY_COMPLETION_SCHEMA = 'machinespirits.adaptation-refinement.inquiry-completion.v1';

function classificationTurn(classification) {
  return classification?.turn || classification?.classifier || classification || {};
}

function learnerDagAssessment(dagModel) {
  return dagModel?.assessment || dagModel || {};
}

/**
 * Project only public-safe schedule counts. At decision N, a row delivered on
 * N has not yet been delivered; this convention lets the same function consume
 * a pre-delivery live snapshot or a post-commit trace snapshot without leaking
 * tutor-turn-N evidence backward into decision N.
 */
export function projectAdaptiveWarrantEvidenceAvailability(releasePacing = null, { turn = null } = {}) {
  const normalizedTurn = Number(turn ?? releasePacing?.turn);
  const scheduleKnown = Array.isArray(releasePacing?.schedule);
  const schedule = scheduleKnown ? releasePacing.schedule : [];
  if (!scheduleKnown || !Number.isFinite(normalizedTurn)) {
    return {
      schema: ADAPTIVE_WARRANT_EVIDENCE_AVAILABILITY_SCHEMA,
      turn: Number.isFinite(normalizedTurn) ? normalizedTurn : null,
      known: false,
      authored_release_count: schedule.length,
      released_before_decision_count: 0,
      due_now_count: 0,
      future_licensed_count: 0,
      remaining_licensed_count: 0,
      release_scope_exhausted: false,
    };
  }
  const releasedBefore = schedule.filter((row) => {
    if (row?.releasedTurn === null || row?.releasedTurn === undefined) return false;
    const released = Number(row?.releasedTurn);
    return Number.isFinite(released) && released < normalizedTurn;
  });
  const remaining = schedule.filter((row) => !releasedBefore.includes(row));
  const dueNow = remaining.filter((row) => Number(row?.effectiveTurn ?? row?.authoredTurn) <= normalizedTurn);
  const future = remaining.filter((row) => Number(row?.effectiveTurn ?? row?.authoredTurn) > normalizedTurn);
  return {
    schema: ADAPTIVE_WARRANT_EVIDENCE_AVAILABILITY_SCHEMA,
    turn: normalizedTurn,
    known: true,
    authored_release_count: schedule.length,
    released_before_decision_count: releasedBefore.length,
    due_now_count: dueNow.length,
    future_licensed_count: future.length,
    remaining_licensed_count: remaining.length,
    release_scope_exhausted: remaining.length === 0,
  };
}

function strictGroundedAsserted(dagModel, closureFrame) {
  const assessment = learnerDagAssessment(dagModel);
  return Boolean(
    closureFrame?.strictGrounded === true ||
    assessment.bottleneck === 'grounded_asserted_secret' ||
    (assessment.finalSecretEntailed === true && assessment.assertedSecret === true),
  );
}

function answerEntailedUnasserted(dagModel) {
  const assessment = learnerDagAssessment(dagModel);
  return Boolean(assessment.finalSecretEntailed === true && assessment.assertedSecret !== true);
}

function boundedScopeContract(scope) {
  if (!scope || scope.enabled !== true) return null;
  const id = String(scope.id || '').trim();
  if (!id) return null;
  return {
    id,
    release_scope_exhausted: scope.release_scope_exhausted === true,
    terminal_outcome_asserted: scope.terminal_outcome_asserted === true,
    evidence_integrated: scope.evidence_integrated === true,
    proof_limit_preserved: scope.proof_limit_preserved === true,
  };
}

/**
 * Assess whole-inquiry completion. A fixed run horizon, empty dueNow list, or
 * local conversational completion never licenses this terminal transition.
 */
export function assessAdaptiveWarrantInquiryCompletion({
  dagModel = null,
  classification = null,
  closureFrame = null,
  evidenceAvailability = null,
  publicObligation = null,
  boundedScope = null,
  unsupportedAssertionCount = 0,
  activeDroppedFactCount = 0,
  releasedEvidenceIntegrated = true,
} = {}) {
  const turn = classificationTurn(classification);
  const blockingObligation = publicObligation?.blocking_obligation || null;
  const obligationRows = Array.isArray(publicObligation?.obligations) ? publicObligation.obligations : null;
  // A valid accountable deferral remains unresolved for later matching
  // release/reminder bookkeeping, but it is deliberately nonblocking. Closure
  // must therefore count only currently actionable tutor debt, not every row
  // retained by the persistent ledger.
  const actionableObligationCount = obligationRows
    ? obligationRows.filter((row) => ['open', 'overdue', 'reactivated'].includes(row?.status)).length
    : 0;
  const openObligationCount = obligationRows
    ? Math.max(actionableObligationCount, blockingObligation ? 1 : 0)
    : Math.max(Number(publicObligation?.open_count || 0), blockingObligation ? 1 : 0);
  const strictComplete = strictGroundedAsserted(dagModel, closureFrame);
  const entailedUnasserted = answerEntailedUnasserted(dagModel);
  const scope = boundedScopeContract(boundedScope);
  const releaseScopeKnown = evidenceAvailability?.known === true;
  const releaseScopeExhausted = evidenceAvailability?.release_scope_exhausted === true;
  const blockers = [];
  if (openObligationCount > 0) blockers.push('open_public_obligation');
  if (Number(unsupportedAssertionCount) > 0) blockers.push('unsupported_assertion');
  if (Number(activeDroppedFactCount) > 0) blockers.push('active_dropped_fact');
  if (!releasedEvidenceIntegrated) blockers.push('released_evidence_not_integrated');
  if (!scope && !releaseScopeKnown) blockers.push('release_scope_unknown');
  if (!scope && releaseScopeKnown && !releaseScopeExhausted) blockers.push('licensed_evidence_remains');

  let basis = null;
  let conclusionKind = null;
  if (strictComplete && releaseScopeKnown && releaseScopeExhausted) {
    basis = 'strict_grounded_asserted';
    conclusionKind = 'answer';
  } else if (
    scope?.release_scope_exhausted &&
    scope.terminal_outcome_asserted &&
    scope.evidence_integrated &&
    scope.proof_limit_preserved
  ) {
    basis = 'authored_bounded_scope';
    conclusionKind = 'bounded_limit';
  }

  const complete = Boolean(basis && blockers.length === 0);
  const status = complete
    ? 'complete'
    : entailedUnasserted && releaseScopeKnown && releaseScopeExhausted && blockers.length === 0
      ? 'answer_entailed_unasserted'
      : 'open';
  return {
    schema: ADAPTIVE_WARRANT_INQUIRY_COMPLETION_SCHEMA,
    status,
    decision_kind: complete ? 'terminal_transition' : 'ordinary_adaptation',
    basis,
    conclusion_kind: conclusionKind,
    learner_move: {
      discourse_move: turn.discourse_move || null,
      epistemic_stance: turn.epistemic_stance || null,
      evidence_use: turn.evidence_use || null,
    },
    checks: {
      strict_grounded_asserted: strictComplete,
      answer_entailed_unasserted: entailedUnasserted,
      authored_dag_satisfied: closureFrame?.authoredDagSatisfied === true,
      release_scope_known: releaseScopeKnown,
      authored_release_count: Number(evidenceAvailability?.authored_release_count || 0),
      released_before_decision_count: Number(evidenceAvailability?.released_before_decision_count || 0),
      release_scope_exhausted: releaseScopeExhausted,
      due_evidence_count: Number(evidenceAvailability?.due_now_count || 0),
      future_licensed_evidence_count: Number(evidenceAvailability?.future_licensed_count || 0),
      remaining_licensed_evidence_count: Number(evidenceAvailability?.remaining_licensed_count || 0),
      released_evidence_integrated: Boolean(releasedEvidenceIntegrated),
      open_public_obligation_count: openObligationCount,
      unsupported_assertion_count: Number(unsupportedAssertionCount || 0),
      active_dropped_fact_count: Number(activeDroppedFactCount || 0),
      explicit_bounded_scope: Boolean(scope),
    },
    blockers,
    transition: complete
      ? {
          kind: 'terminal_transition',
          revision_warranted: true,
          recommended_action_family: 'close_inquiry',
        }
      : null,
  };
}
