export const TUTOR_STUB_PROOF_DEBT_SCHEMA = 'machinespirits.tutor-stub.proof-debt-state.v1';

function rowKey(row = {}) {
  return [row.surface, row.warrantNeeded, row.reason, row.source].filter(Boolean).join('|').toLowerCase();
}

function uniqueRows(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = rowKey(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildTutorStubProofDebtState({
  dagMode,
  warrantPremiseAudit,
  strictDag = null,
  classification = null,
  generousInference = null,
} = {}) {
  const enabled = dagMode !== 'strict_dag';
  const audit = warrantPremiseAudit || {};
  const candidates = uniqueRows([
    ...(audit.proofDebtCandidates || []),
    ...(audit.warrants?.missing || []),
    ...(audit.warrants?.implied || []),
    ...(audit.premises?.impliedPublic || []),
    ...(audit.premises?.commonSenseBridges || []),
  ]);
  const harmful = [...(audit.premises?.suppressedOrPrivate || []), ...(audit.premises?.illicitHidden || [])];
  const labels = [
    classification?.turn?.evidence_use,
    classification?.turn?.epistemic_stance,
    classification?.turn?.discourse_move,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const unsafeLeap =
    !generousInference?.applied &&
    /overleaps_evidence|distorts_public_evidence|overconfident|answer_seeking/iu.test(labels);
  const caseClosing = Boolean(
    strictDag?.assertedSecret || strictDag?.assertedMirror || Number(strictDag?.unsupportedAssertionCount || 0) > 0,
  );
  const mayElide = dagMode === 'defeasible_human_scaffold' && !harmful.length && !unsafeLeap && !caseClosing;
  const elided = mayElide
    ? candidates.filter(
        (row) =>
          row.source !== 'strict_dag_rejection' &&
          row.source !== 'heuristic_overleap' &&
          (/implied|common_sense|provisional|missing_warrant/iu.test(row.source || '') ||
            /omits_warrant/iu.test(labels)),
      )
    : [];
  const elidedKeys = new Set(elided.map(rowKey));
  const open = candidates.filter((row) => !elidedKeys.has(rowKey(row)));
  const discharged = audit.strictProofAdoptions || [];
  const repaired = [];
  const buckets = { open, elided, repaired, discharged, harmful };
  const status = !enabled
    ? 'not_enabled_strict_dag'
    : harmful.length
      ? 'harmful_hidden_premise_risk'
      : open.length
        ? 'open_proof_debt'
        : 'none_open';
  return {
    schema: TUTOR_STUB_PROOF_DEBT_SCHEMA,
    mode: dagMode,
    enabled,
    status,
    elision: {
      applied: elided.length > 0,
      count: elided.length,
      reason: elided.length
        ? 'ordinary public bridge carried by the defeasible scaffold instead of demanded from the learner'
        : mayElide
          ? 'no compressible proof-debt row was present'
          : 'elision withheld because the move was unsafe, hidden, conflicting, or case-closing',
      tutorInstruction: elided.length
        ? 'Treat the elided bridge as complete in the spoken exchange. Do not ask the learner to restate it or supply its omitted warrant.'
        : null,
    },
    ...buckets,
    counts: Object.fromEntries(Object.entries(buckets).map(([key, rows]) => [key, rows.length])),
  };
}
