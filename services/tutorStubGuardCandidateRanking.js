import {
  decideTutorStubGuardDelivery,
  TUTOR_STUB_GUARD_BOUNDARY_POLICIES,
  tutorStubGuardIssueRows,
} from './tutorStubGuardDisposition.js';

export const TUTOR_STUB_GUARD_CANDIDATE_RANKING_SCHEMA = 'machinespirits.tutor-stub.guard-candidate-ranking.v1';

const CONTRACT_CATEGORIES = new Set([
  'public_evidence_integrity',
  'clue_transaction_integrity',
  'semantic_closure_integrity',
  'unknown',
]);

function textOf(attempt) {
  return String(attempt?.candidate?.text || '').trim();
}

function compareScores(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function candidateRow(attempt, index) {
  const attemptNumber = Number.isFinite(Number(attempt?.attempt)) ? Number(attempt.attempt) : index;
  const issues = tutorStubGuardIssueRows(attempt?.audits);
  const allowActorialAdvisory = attempt?.audits?.deliveryDecision?.allowActorialAdvisory === true;
  const shadow = decideTutorStubGuardDelivery(issues, {
    allowActorialAdvisory,
    boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory,
  });
  const strict = decideTutorStubGuardDelivery(issues, {
    allowActorialAdvisory,
    boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.strict,
  });
  const contractBlockers = shadow.dispositions
    .filter((row) => row.effectiveDisposition === 'hard' && CONTRACT_CATEGORIES.has(row.category))
    .map((row) => ({ ...row.issue, category: row.category, ruleId: row.ruleId }));
  return {
    attempt,
    index,
    kind: String(attempt?.kind || 'unknown'),
    attemptNumber,
    text: textOf(attempt),
    issues,
    shadow,
    strict,
    contractBlockers,
    eligible: contractBlockers.length === 0,
    // Reproduce the zero-model replay's ordering: first minimize findings
    // that remain hard under the live shadow column, then use the strict
    // column as the weight for findings demoted by shadow. Generation order
    // is the deterministic final tie-break.
    score: [shadow.hardIssues.length, strict.hardIssues.length, attemptNumber, index],
  };
}

function projectedRow(row) {
  return {
    kind: row.kind,
    attempt: row.attemptNumber,
    eligible: row.eligible,
    score: {
      shadowHard: row.score[0],
      strictHard: row.score[1],
      generationOrder: row.score[2],
    },
    contractBlockers: row.contractBlockers,
    hardIssues: row.shadow.hardIssues,
    advisoryIssues: row.shadow.advisoryIssues,
    reportOnlyIssues: row.shadow.reportOnlyIssues,
  };
}

export function rankTutorStubGuardCandidates(attempts = []) {
  const rows = (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) => attempt?.kind !== 'deterministic_fallback' && textOf(attempt))
    .map(candidateRow);
  const eligible = rows.filter((row) => row.eligible).sort((left, right) => compareScores(left.score, right.score));
  const selected = eligible[0] || null;
  return {
    schema: TUTOR_STUB_GUARD_CANDIDATE_RANKING_SCHEMA,
    policy: 'closest_non_contract_candidate_v1',
    selected: selected ? projectedRow(selected) : null,
    candidates: rows.map(projectedRow),
    selectedAttempt: selected?.attempt || null,
    selectedDecision: selected?.shadow || null,
  };
}

export function authorizeTutorStubRankedCandidate(audits, ranking) {
  const decision = ranking?.selectedDecision;
  if (!ranking?.selected || !decision || ranking.selected.contractBlockers.length) return null;
  const overriddenHardIssues = decision.hardIssues.map((issue) => ({ ...issue }));
  const deliveryDecision = {
    ...decision,
    version: 3,
    ok: true,
    hardIssues: [],
    advisoryIssues: [...decision.advisoryIssues.map((issue) => ({ ...issue })), ...overriddenHardIssues],
    dispositions: decision.dispositions.map((row) =>
      row.effectiveDisposition === 'hard'
        ? { ...row, effectiveDisposition: 'advisory', rankedCandidateOverride: true }
        : { ...row },
    ),
    rankedCandidateOverride: {
      schema: TUTOR_STUB_GUARD_CANDIDATE_RANKING_SCHEMA,
      policy: ranking.policy,
      selectedKind: ranking.selected.kind,
      selectedAttempt: ranking.selected.attempt,
      score: ranking.selected.score,
      overriddenHardIssues,
      contractCategoriesRemainAbsolute: true,
    },
    provenance: {
      ...decision.provenance,
      fallbackSelectionPolicy: ranking.policy,
    },
  };
  return {
    ...audits,
    deliveryOk: true,
    deliveryDecision,
  };
}
