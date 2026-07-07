export const LEARNER_ENTITLEMENT_SCHEMA = 'dramatic-derivation.learner-entitlement.v0';

function normConductToken(value) {
  return String(value || '')
    .toLowerCase()
    .trim();
}

function samePremise(a, b) {
  return Boolean(a && b && String(a) === String(b));
}

function priorConductPolicies(transcript = [], turn) {
  return (Array.isArray(transcript) ? transcript : [])
    .filter((line) => line?.role === 'tutor' && Number(line.turn) < Number(turn) && line.meta?.conductPolicy)
    .map((line) => ({ turn: Number(line.turn), policy: line.meta.conductPolicy }))
    .filter((row) => Number.isFinite(row.turn));
}

function priorDiagnosticLikeTutorMoves(transcript = [], turn) {
  const diagnosticIntents = new Set(['test', 'confront']);
  return (Array.isArray(transcript) ? transcript : [])
    .filter((line) => line?.role === 'tutor' && Number(line.turn) < Number(turn))
    .map((line) => {
      const move = line.meta?.move || {};
      return {
        turn: Number(line.turn),
        targetPremise: move.targetPremise || move.target_premise || null,
        intent: normConductToken(move.intent),
        release: line.meta?.release ?? null,
      };
    })
    .filter((row) => Number.isFinite(row.turn) && !row.release && diagnosticIntents.has(row.intent));
}

export function visibleConflictDiagnosticBudget({ transcript = [], turn, premiseId } = {}) {
  const rows = priorConductPolicies(transcript, turn).filter(
    (row) =>
      row.policy?.active === true &&
      row.policy?.reasonCode === 'visible_hidden_conflict' &&
      row.policy?.selectedMoveFamily === 'ask_diagnostic',
  );
  const last = rows[rows.length - 1] || null;
  if (last && Number(turn) - last.turn <= 1 && samePremise(last.policy?.targetPremise, premiseId)) {
    return {
      allowed: false,
      exhausted: true,
      reason: 'same_premise_adjacent_visible_conflict_diagnostic',
      priorTurn: last.turn,
    };
  }
  const recent = rows.filter((row) => Number(turn) - row.turn <= 3);
  if (recent.length >= 2) {
    return {
      allowed: false,
      exhausted: true,
      reason: 'recent_visible_conflict_diagnostic_budget_exhausted',
      priorTurns: recent.map((row) => row.turn),
    };
  }
  const recentTutorDiagnostics = priorDiagnosticLikeTutorMoves(transcript, turn);
  const lastTutorDiagnostic = recentTutorDiagnostics[recentTutorDiagnostics.length - 1] || null;
  if (
    lastTutorDiagnostic &&
    Number(turn) - lastTutorDiagnostic.turn <= 1 &&
    samePremise(lastTutorDiagnostic.targetPremise, premiseId)
  ) {
    return {
      allowed: false,
      exhausted: true,
      reason: 'same_premise_adjacent_public_diagnostic',
      priorTurn: lastTutorDiagnostic.turn,
    };
  }
  const recentPublicDiagnostics = recentTutorDiagnostics.filter((row) => Number(turn) - row.turn <= 3);
  if (recentPublicDiagnostics.length >= 2) {
    return {
      allowed: false,
      exhausted: true,
      reason: 'recent_public_diagnostic_budget_exhausted',
      priorTurns: recentPublicDiagnostics.map((row) => row.turn),
    };
  }
  return { allowed: true, exhausted: false };
}

function playableEntry(playable = [], premiseId) {
  if (!premiseId) return null;
  return playable.find((entry) => entry?.premise === premiseId) || null;
}

export function isCurrentAuthorizedRelease(
  premiseId,
  { turn, playable = [], forcedPlay = null, releaseDecision = null } = {},
) {
  if (!premiseId) return false;
  const currentTurn = Number(turn ?? releaseDecision?.turn);
  if (!Number.isFinite(currentTurn)) return false;
  if (releaseDecision?.forced === premiseId || forcedPlay?.premise === premiseId) return true;
  if (releaseDecision?.pacingGuard?.forcedSafe === true && releaseDecision?.played === premiseId) return true;
  const scheduledTurn =
    playableEntry(playable, premiseId)?.turn ??
    (releaseDecision?.played === premiseId ? releaseDecision?.scheduledTurn : null);
  return Number(scheduledTurn) === currentTurn;
}

export function releaseSafeAtCurrentTurn(premiseId, releaseDecision) {
  if (!premiseId || !releaseDecision) return false;
  const turn = Number(releaseDecision.turn);
  const safeTurns = releaseDecision?.pacingGuard?.safeTurns?.[premiseId];
  if (Array.isArray(safeTurns) && safeTurns.map(Number).includes(turn)) return true;
  const candidateSolvency = releaseDecision?.pacingGuard?.candidateSolvency;
  if (candidateSolvency?.premise === premiseId && candidateSolvency.safe === true) return true;
  const playedSolvency = releaseDecision?.pacingGuard?.playedSolvency;
  if (playedSolvency?.premise === premiseId && playedSolvency.safe === true) return true;
  return false;
}

export function firstSafeCurrentAuthorizedReleaseCandidate(
  releaseDecision,
  { turn, playable = [], forcedPlay = null } = {},
) {
  const opts = { turn: turn ?? releaseDecision?.turn, playable, forcedPlay, releaseDecision };
  const direct =
    releaseDecision?.pacingGuard?.candidate ||
    releaseDecision?.consolidationGuard?.hiddenCandidate ||
    releaseDecision?.visibleGuard?.candidate ||
    null;
  if (direct && isCurrentAuthorizedRelease(direct, opts) && releaseSafeAtCurrentTurn(direct, releaseDecision)) {
    return direct;
  }
  const safeTurns = releaseDecision?.pacingGuard?.safeTurns;
  if (!safeTurns || typeof safeTurns !== 'object') return null;
  const currentTurn = Number(releaseDecision?.turn);
  for (const [premiseId, turns] of Object.entries(safeTurns)) {
    if (!Array.isArray(turns)) continue;
    if (
      Number.isFinite(currentTurn) &&
      turns.map(Number).includes(currentTurn) &&
      isCurrentAuthorizedRelease(premiseId, opts)
    ) {
      return premiseId;
    }
  }
  return null;
}

function sanitizeDebt(debt) {
  if (!debt || typeof debt !== 'object') return null;
  return {
    ...(debt.premiseId ? { premiseId: debt.premiseId } : {}),
    ...(debt.surface ? { surface: debt.surface } : {}),
    ...(debt.sinceTurn != null ? { sinceTurn: debt.sinceTurn } : {}),
  };
}

function proofDebtEntitlement(proofDebtTutorView) {
  const debts = Array.isArray(proofDebtTutorView?.debts)
    ? proofDebtTutorView.debts.map(sanitizeDebt).filter(Boolean)
    : [];
  return {
    active: Boolean(proofDebtTutorView?.active && debts.length),
    targetPremise: debts[0]?.premiseId || null,
    debtCount: debts.length,
    debts,
  };
}

function visibleFeatures(visibleConsolidation) {
  const features = visibleConsolidation?.features || null;
  if (!features || typeof features !== 'object') return null;
  return {
    priorPremiseId: features.priorPremiseId || null,
    priorEcho: Number.isFinite(Number(features.priorEcho)) ? Number(features.priorEcho) : null,
    priorEchoed: features.priorEchoed === true,
    stalling: features.stalling === true,
    turnsSinceLastRelease: Number.isFinite(Number(features.turnsSinceLastRelease))
      ? Number(features.turnsSinceLastRelease)
      : null,
  };
}

function releaseEntitlement({ releaseDecision, turn, playable, forcedPlay }) {
  const played = releaseDecision?.played || null;
  const candidate =
    played ||
    releaseDecision?.pacingGuard?.candidate ||
    releaseDecision?.consolidationGuard?.hiddenCandidate ||
    releaseDecision?.visibleGuard?.candidate ||
    null;
  const scheduledTurn = candidate
    ? (playableEntry(playable, candidate)?.turn ?? (played === candidate ? releaseDecision?.scheduledTurn : null))
    : null;
  const currentAuthorized = candidate
    ? isCurrentAuthorizedRelease(candidate, { turn, playable, forcedPlay, releaseDecision })
    : false;
  const safeAtCurrent = candidate ? releaseSafeAtCurrentTurn(candidate, releaseDecision) : false;
  const earlyOptional = Boolean(played && !currentAuthorized);
  const progressCandidate = firstSafeCurrentAuthorizedReleaseCandidate(releaseDecision, {
    turn,
    playable,
    forcedPlay,
  });
  return {
    played,
    candidate,
    targetPremise: progressCandidate || played || candidate || null,
    currentAuthorized,
    safeAtCurrent,
    earlyOptional,
    progressCandidate,
    scheduledTurn: scheduledTurn ?? null,
    offset: releaseDecision?.offset ?? null,
    forced: releaseDecision?.forced || forcedPlay?.premise || null,
    hiddenCertified: releaseDecision?.hybridGuard?.accepted === true,
  };
}

function visibleEntitlement({ view, releaseDecision, visibleConsolidation, release, conductProgressPolicy }) {
  const active = Boolean(
    releaseDecision?.hybridGuard?.accepted === false ||
    releaseDecision?.consolidationGuard?.visiblePushIgnored ||
    (releaseDecision?.visibleGuard?.blocked &&
      releaseDecision?.pacingGuard &&
      !releaseDecision.consolidationGuard?.held) ||
    visibleConsolidation?.features?.stalling ||
    visibleConsolidation?.features?.priorEchoed === false,
  );
  const premiseId =
    releaseDecision?.visibleGuard?.candidate ||
    releaseDecision?.pacingGuard?.candidate ||
    visibleConsolidation?.features?.priorPremiseId ||
    release.targetPremise ||
    null;
  const budget = active
    ? visibleConflictDiagnosticBudget({ transcript: view.transcript, turn: view.turn, premiseId })
    : { allowed: true, exhausted: false };
  return {
    active,
    premiseId,
    hiddenCertifiedRelease: release.hiddenCertified,
    reason:
      releaseDecision?.visibleGuard?.reason ||
      releaseDecision?.hybridGuard?.reason ||
      releaseDecision?.consolidationGuard?.reason ||
      (visibleConsolidation?.lines || []).join(' ') ||
      null,
    features: visibleFeatures(visibleConsolidation),
    diagnosticBudget: budget,
    progressPressure: Boolean(active && budget.exhausted && conductProgressPolicy),
  };
}

export function deriveEntitlementState({
  view,
  proofDebtTutorView = null,
  releaseDecision = null,
  playable = [],
  forcedPlay = null,
  forcedNote = false,
  finalEntitlement = null,
  visibleConsolidation = null,
  conductProgressPolicy = false,
  validAlternativeCandidate = null,
  recognitionNeed = null,
} = {}) {
  const turn = Number(view?.turn ?? releaseDecision?.turn);
  const release = releaseEntitlement({
    releaseDecision,
    turn,
    playable,
    forcedPlay,
  });
  const proofDebt = proofDebtEntitlement(proofDebtTutorView);
  const visible = visibleEntitlement({
    view: view || {},
    releaseDecision,
    visibleConsolidation,
    release,
    conductProgressPolicy,
  });
  const validAlternative = {
    active: Boolean(validAlternativeCandidate?.active),
    targetPremise: validAlternativeCandidate?.premiseId || validAlternativeCandidate?.targetPremise || null,
    reason: validAlternativeCandidate?.reason || null,
  };
  const finalAssertion = {
    available: Boolean(forcedNote || finalEntitlement?.canAssertFinal),
  };
  const recognition = {
    active: recognitionNeed?.active === true,
    level: recognitionNeed?.level ?? null,
    desiredActs: Array.isArray(recognitionNeed?.desiredActs) ? recognitionNeed.desiredActs : [],
  };
  const uncertaintyActive = Boolean(
    visible.active && visible.diagnosticBudget?.allowed !== false && !release.played && !proofDebt.active,
  );
  return {
    schema: LEARNER_ENTITLEMENT_SCHEMA,
    turn: Number.isFinite(turn) ? turn : null,
    proofDebt,
    release,
    visible,
    finalAssertion,
    validAlternative,
    recognition,
    diagnostic: visible.diagnosticBudget || { allowed: true, exhausted: false },
    uncertainty: {
      active: uncertaintyActive,
      reason: uncertaintyActive ? 'visible evidence is public but not yet settled' : null,
    },
  };
}

export function entitlementNeedsConduct(entitlement, { conductProgressPolicy = false } = {}) {
  if (!entitlement || typeof entitlement !== 'object') return false;
  if (entitlement.validAlternative?.active) return true;
  if (entitlement.proofDebt?.active) return true;
  if (entitlement.recognition?.active) return true;
  if (entitlement.finalAssertion?.available) return true;
  if (entitlement.release?.played) return true;
  if (entitlement.visible?.active) {
    if (entitlement.diagnostic?.exhausted && !conductProgressPolicy) return false;
    return true;
  }
  return false;
}
