import { TUTOR_STUB_HUMAN_DISCOURSE_PHASE } from './tutorStubHumanDiscourseConfig.js';

export const TUTOR_STUB_WARRANT_PREMISE_AUDIT_SCHEMA = 'machinespirits.tutor-stub.warrant-premise-audit.v1';

export function projectTutorStubPublicStocktakeRows(rows = [], source = 'learner_record') {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      surface: String(row?.surface || row?.text || '').trim(),
      turn: Number.isFinite(Number(row?.turn)) ? Number(row.turn) : null,
      source,
    }))
    .filter((row) => row.surface);
}

export function projectTutorStubWarrantPremiseAudit({
  dagMode,
  model = null,
  extraction,
  explicitWarrants = [],
  explicitPublicPremises = [],
  heuristicMissingWarrants = [],
  rejectedDebt = [],
  strictProofAdoptions = [],
}) {
  const proofDebtCandidates = [
    ...extraction.proofDebtCandidates,
    ...extraction.provisionalClaims
      .filter((row) => row.warrantNeeded)
      .map((row) => ({ ...row, reason: row.reason || row.warrantNeeded })),
    ...heuristicMissingWarrants,
    ...rejectedDebt,
  ];
  const proofStatus =
    model?.assessment?.finalSecretEntailed && model?.assessment?.assertedSecret
      ? 'strict_grounded_closure'
      : extraction.proofStatus !== 'unclear'
        ? extraction.proofStatus
        : proofDebtCandidates.length
          ? 'provisional_or_debt_open'
          : 'strict_or_open';
  return {
    schema: TUTOR_STUB_WARRANT_PREMISE_AUDIT_SCHEMA,
    mode: dagMode,
    phase: TUTOR_STUB_HUMAN_DISCOURSE_PHASE,
    proofStatus,
    status:
      dagMode === 'strict_dag'
        ? 'strict_audit_only'
        : extraction.illicitHiddenPremises.length || extraction.suppressedPremises.length
          ? 'hidden_or_suppressed_premise_risk'
          : proofDebtCandidates.length
            ? 'proof_debt_open'
            : 'current_turn_clean',
    warrants: {
      explicit: explicitWarrants,
      implied: extraction.impliedWarrants,
      missing: [...extraction.missingWarrants, ...heuristicMissingWarrants],
    },
    premises: {
      explicitPublic: explicitPublicPremises,
      impliedPublic: extraction.impliedPremises,
      suppressedOrPrivate: extraction.suppressedPremises,
      commonSenseBridges: extraction.commonSenseBridges,
      illicitHidden: extraction.illicitHiddenPremises,
    },
    provisionalClaims: extraction.provisionalClaims,
    proofDebtCandidates,
    strictProofAdoptions,
    extractionSideArc: extraction.sideArc,
    counts: {
      explicitWarrants: explicitWarrants.length,
      impliedWarrants: extraction.impliedWarrants.length,
      missingWarrants: extraction.missingWarrants.length + heuristicMissingWarrants.length,
      explicitPublicPremises: explicitPublicPremises.length,
      impliedPremises: extraction.impliedPremises.length,
      suppressedPremises: extraction.suppressedPremises.length,
      commonSenseBridges: extraction.commonSenseBridges.length,
      illicitHiddenPremises: extraction.illicitHiddenPremises.length,
      provisionalClaims: extraction.provisionalClaims.length,
      proofDebtCandidates: proofDebtCandidates.length,
      strictProofAdoptions: strictProofAdoptions.length,
    },
  };
}
