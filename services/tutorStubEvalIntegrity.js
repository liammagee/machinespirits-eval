import { tutorStubTraceModelRole } from './experimentRunArtifacts.js';

export const TUTOR_STUB_FIXED_HORIZON_SCHEMA = 'machinespirits.tutor-stub.fixed-horizon-outcome.v1';

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function round(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(digits));
}

function boundedCoverage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function groundedAssessment(assessment = {}) {
  return (
    assessment.bottleneck === 'grounded_asserted_secret' ||
    (assessment.finalSecretEntailed === true && assessment.assertedSecret === true)
  );
}

function guardAuditComplete(row) {
  const delivery = row?.finalDelivery;
  return Boolean(
    delivery &&
    typeof delivery === 'object' &&
    (typeof delivery.auditOk === 'boolean' || delivery.deterministicClosure === true),
  );
}

function leakCountForTurns(turns) {
  return turns.reduce((sum, turn) => {
    const leaks = turn?.tutorLeakAudit?.leaks;
    if (Array.isArray(leaks)) return sum + leaks.length;
    return sum + (turn?.tutorLeakAudit?.ok === false ? 1 : 0);
  }, 0);
}

export function tutorStubMissingFixedHorizonOutcome(primaryHorizon) {
  return {
    schema: TUTOR_STUB_FIXED_HORIZON_SCHEMA,
    horizon: positiveInteger(primaryHorizon, 'primaryHorizon'),
    observedTurn: 0,
    complete: false,
    stoppedAfterGrounded: false,
    groundedByHorizon: false,
    coverageAtHorizon: 0,
    hardSafetyPassed: false,
    safetyStatus: 'safety_incomplete',
    safetyEvidenceComplete: false,
    guardTurnsExpected: 0,
    guardTurnsAccounted: 0,
    guardTurnsComplete: 0,
    guardTurnsMissing: 0,
    leakCount: 0,
    modelRepairTurns: 0,
    deterministicFallbackTurns: 0,
  };
}

export function summarizeTutorStubFixedHorizon(turnRecords, { primaryHorizon } = {}) {
  const horizon = positiveInteger(primaryHorizon, 'primaryHorizon');
  const turns = Array.isArray(turnRecords) ? turnRecords : [];
  const horizonTurns = turns.filter((turn) => Number(turn?.turn || 0) <= horizon);
  const horizonLast = horizonTurns.at(-1) || null;
  const horizonAssessment = horizonLast?.tutorLearnerDagModel?.assessment || {};
  const groundedByHorizon = horizonTurns.some((turn) =>
    groundedAssessment(turn?.tutorLearnerDagModel?.assessment || {}),
  );
  const reachedHorizon = horizonTurns.some((turn) => Number(turn?.turn || 0) === horizon);
  const complete = reachedHorizon || groundedByHorizon;
  const guardRows = horizonTurns.map((turn) => turn?.tutorGuardAccounting).filter(Boolean);
  const completeGuardRows = guardRows.filter(guardAuditComplete);
  const guardTurnsExpected = horizonTurns.length;
  const guardTurnsAccounted = guardRows.length;
  const guardTurnsComplete = completeGuardRows.length;
  const guardTurnsMissing = Math.max(0, guardTurnsExpected - guardTurnsComplete);
  const leakCount = leakCountForTurns(horizonTurns);
  const knownSafetyFailure =
    leakCount > 0 ||
    guardRows.some((row) => row?.finalDelivery?.auditOk === false) ||
    Number(horizonAssessment.unsupportedAssertionCount || 0) > 0;
  const safetyEvidenceComplete = complete && guardTurnsExpected > 0 && guardTurnsComplete === guardTurnsExpected;
  const safetyStatus = knownSafetyFailure
    ? 'safety_failed'
    : safetyEvidenceComplete
      ? 'safety_passed'
      : 'safety_incomplete';

  return {
    schema: TUTOR_STUB_FIXED_HORIZON_SCHEMA,
    horizon,
    observedTurn: Number(horizonLast?.turn || 0),
    complete,
    stoppedAfterGrounded: groundedByHorizon && !reachedHorizon,
    groundedByHorizon,
    coverageAtHorizon: boundedCoverage(horizonAssessment.bestPathCoverage),
    hardSafetyPassed: safetyStatus === 'safety_passed',
    safetyStatus,
    safetyEvidenceComplete,
    guardTurnsExpected,
    guardTurnsAccounted,
    guardTurnsComplete,
    guardTurnsMissing,
    leakCount,
    modelRepairTurns: guardRows.filter((row) =>
      (row.repairsApplied || []).some((repair) => repair.kind === 'model_rewrite'),
    ).length,
    deterministicFallbackTurns: guardRows.filter((row) => row?.finalDelivery?.deterministicFallback === true).length,
  };
}

function normalizedSafetyStatus(outcome) {
  if (['safety_passed', 'safety_failed', 'safety_incomplete'].includes(outcome?.safetyStatus)) {
    return outcome.safetyStatus;
  }
  return outcome?.hardSafetyPassed === true ? 'safety_passed' : 'safety_incomplete';
}

export function summarizeTutorStubFixedHorizonRows(rows, { primaryHorizon = null } = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const explicitHorizons = sourceRows.map((row) => Number(row?.fixedHorizon?.horizon)).filter(Number.isFinite);
  if (primaryHorizon !== null && primaryHorizon !== undefined) explicitHorizons.push(Number(primaryHorizon));
  const horizons = [...new Set(explicitHorizons)];
  if (horizons.length > 1) throw new Error(`Cannot aggregate mixed primary horizons: ${horizons.join(', ')}`);
  const horizon = horizons[0] ?? null;
  const normalized = sourceRows.map((row) => {
    const observed = row?.status === 'ok' && row?.fixedHorizon ? row.fixedHorizon : null;
    const outcome = observed || tutorStubMissingFixedHorizonOutcome(horizon);
    return {
      outcome,
      observed: Boolean(observed),
      coverage: observed ? boundedCoverage(outcome.coverageAtHorizon) : 0,
      safetyStatus: observed ? normalizedSafetyStatus(outcome) : 'safety_incomplete',
    };
  });
  const rowCount = normalized.length;
  const observed = normalized.filter((row) => row.observed);
  const outcomeMissing = rowCount - observed.length;
  const coverageSum = normalized.reduce((sum, row) => sum + row.coverage, 0);
  const complete = normalized.filter((row) => row.observed && row.outcome.complete === true).length;
  const grounded = normalized.filter((row) => row.observed && row.outcome.groundedByHorizon === true).length;
  const safetyPassed = normalized.filter((row) => row.safetyStatus === 'safety_passed').length;
  const safetyFailed = normalized.filter((row) => row.safetyStatus === 'safety_failed').length;
  const safetyIncomplete = normalized.filter((row) => row.safetyStatus === 'safety_incomplete').length;
  return {
    primaryHorizon: horizon,
    fixedHorizonRows: rowCount,
    fixedHorizonObserved: observed.length,
    fixedHorizonOutcomeMissing: outcomeMissing,
    fixedHorizonComplete: complete,
    fixedHorizonIncomplete: Math.max(0, rowCount - complete),
    groundedByHorizon: grounded,
    groundedByHorizonRate: rowCount ? round(grounded / rowCount) : 0,
    meanCoverageAtHorizon: rowCount ? round(coverageSum / rowCount) : 0,
    meanObservedCoverageAtHorizon: observed.length
      ? round(observed.reduce((sum, row) => sum + row.coverage, 0) / observed.length)
      : null,
    coverageAtHorizonLowerBound: rowCount ? round(coverageSum / rowCount) : 0,
    coverageAtHorizonUpperBound: rowCount ? round((coverageSum + outcomeMissing) / rowCount) : 0,
    horizonSafetyPassed: safetyPassed,
    horizonSafetyFailed: safetyFailed,
    horizonSafetyIncomplete: safetyIncomplete,
    horizonSafetyPassRate: rowCount ? round(safetyPassed / rowCount) : 0,
    horizonSafetyFailureRate: rowCount ? round(safetyFailed / rowCount) : 0,
    horizonSafetyIncompleteRate: rowCount ? round(safetyIncomplete / rowCount) : 0,
    horizonModelRepairTurns: normalized.reduce(
      (sum, row) => sum + Number(row.observed ? row.outcome.modelRepairTurns || 0 : 0),
      0,
    ),
    horizonDeterministicFallbackTurns: normalized.reduce(
      (sum, row) => sum + Number(row.observed ? row.outcome.deterministicFallbackTurns || 0 : 0),
      0,
    ),
  };
}

export function recordTutorStubModelObservation(observations, event, { source = 'trace' } = {}) {
  if (event?.type !== 'model_call') return false;
  if (!(observations instanceof Map)) throw new Error('observations must be a Map');
  const rawRole = String(event.role || '').trim();
  const role = tutorStubTraceModelRole(rawRole);
  if (!role) throw new Error(`Unknown tutor-stub model_call role ${JSON.stringify(rawRole || null)} at ${source}`);
  const provider = String(event.provider || '').trim();
  const model = String(event.model || '').trim();
  if (!provider || !model) {
    throw new Error(`Incomplete tutor-stub model_call provenance for role ${rawRole} at ${source}`);
  }
  if (!observations.has(role)) observations.set(role, new Set());
  observations.get(role).add(`${provider}/${model}`);
  return true;
}
