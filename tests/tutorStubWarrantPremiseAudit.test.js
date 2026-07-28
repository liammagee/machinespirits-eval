import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_WARRANT_PREMISE_AUDIT_SCHEMA,
  projectTutorStubPublicStocktakeRows,
  projectTutorStubWarrantPremiseAudit,
} from '../services/tutorStubWarrantPremiseAudit.js';

function extraction(overrides = {}) {
  return {
    proofStatus: 'unclear',
    impliedWarrants: [],
    missingWarrants: [],
    impliedPremises: [],
    suppressedPremises: [],
    commonSenseBridges: [],
    illicitHiddenPremises: [],
    provisionalClaims: [],
    proofDebtCandidates: [],
    sideArc: null,
    ...overrides,
  };
}

test('public stocktake projection normalizes rows and drops empty surfaces', () => {
  assert.deepEqual(
    projectTutorStubPublicStocktakeRows(
      [{ surface: '  public claim  ', turn: '2' }, { text: 'fallback text', turn: 'not-a-number' }, { surface: '   ' }],
      'fixture',
    ),
    [
      { surface: 'public claim', turn: 2, source: 'fixture' },
      { surface: 'fallback text', turn: null, source: 'fixture' },
    ],
  );
});

test('warrant audit projection preserves strict closure, debts, counts, and schema', () => {
  const heuristic = [{ surface: 'Learner leap', source: 'heuristic_overleap' }];
  const rejected = [{ surface: 'Rejected premise', source: 'strict_dag_rejection' }];
  const audit = projectTutorStubWarrantPremiseAudit({
    dagMode: 'strict_dag',
    model: { assessment: { finalSecretEntailed: true, assertedSecret: true } },
    extraction: extraction({
      impliedWarrants: [{ surface: 'Implied warrant' }],
      missingWarrants: [{ surface: 'Missing warrant' }],
      impliedPremises: [{ surface: 'Implied premise' }],
      suppressedPremises: [{ surface: 'Suppressed premise' }],
      commonSenseBridges: [{ surface: 'Bridge' }],
      illicitHiddenPremises: [{ surface: 'Hidden premise' }],
      provisionalClaims: [{ surface: 'Claim', warrantNeeded: 'Need link' }],
      proofDebtCandidates: [{ surface: 'Existing debt' }],
      sideArc: { detected: true },
    }),
    explicitWarrants: [{ surface: 'Explicit warrant' }],
    explicitPublicPremises: [{ surface: 'Public premise' }],
    heuristicMissingWarrants: heuristic,
    rejectedDebt: rejected,
    strictProofAdoptions: [{ surface: 'Adopted' }],
  });

  assert.equal(audit.schema, TUTOR_STUB_WARRANT_PREMISE_AUDIT_SCHEMA);
  assert.equal(audit.phase, 'phase_2_human_scaffold_prompting');
  assert.equal(audit.proofStatus, 'strict_grounded_closure');
  assert.equal(audit.status, 'strict_audit_only');
  assert.equal(audit.counts.missingWarrants, 2);
  assert.equal(audit.counts.proofDebtCandidates, 4);
  assert.deepEqual(audit.warrants.missing.at(-1), heuristic[0]);
  assert.deepEqual(audit.proofDebtCandidates.at(-1), rejected[0]);
  assert.deepEqual(audit.extractionSideArc, { detected: true });
});

test('warrant audit projection preserves risk, debt, clean, and explicit proof statuses', () => {
  const hidden = projectTutorStubWarrantPremiseAudit({
    dagMode: 'human_scaffold',
    extraction: extraction({ illicitHiddenPremises: [{ surface: 'Hidden' }] }),
  });
  assert.equal(hidden.status, 'hidden_or_suppressed_premise_risk');

  const debt = projectTutorStubWarrantPremiseAudit({
    dagMode: 'defeasible_human_scaffold',
    extraction: extraction({ provisionalClaims: [{ surface: 'Claim', warrantNeeded: 'Why?' }] }),
  });
  assert.equal(debt.status, 'proof_debt_open');
  assert.equal(debt.proofStatus, 'provisional_or_debt_open');
  assert.equal(debt.proofDebtCandidates[0].reason, 'Why?');

  const clean = projectTutorStubWarrantPremiseAudit({
    dagMode: 'human_scaffold',
    extraction: extraction({ proofStatus: 'publicly_grounded' }),
  });
  assert.equal(clean.status, 'current_turn_clean');
  assert.equal(clean.proofStatus, 'publicly_grounded');
});
