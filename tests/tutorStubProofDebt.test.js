import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTutorStubProofDebtState } from '../services/tutorStubProofDebt.js';

const ordinaryMissingWarrant = {
  warrants: {
    missing: [{ surface: 'Why the matching mark identifies the tool.', source: 'extractor_missing_warrant' }],
    implied: [],
  },
  premises: { impliedPublic: [], commonSenseBridges: [], suppressedOrPrivate: [], illicitHidden: [] },
  proofDebtCandidates: [],
  strictProofAdoptions: [],
};

test('defeasible scaffold elides an ordinary omitted warrant from spoken proof debt', () => {
  const state = buildTutorStubProofDebtState({
    dagMode: 'defeasible_human_scaffold',
    warrantPremiseAudit: ordinaryMissingWarrant,
    strictDag: { assertedSecret: false, assertedMirror: false, unsupportedAssertionCount: 0 },
    classification: { turn: { evidence_use: 'omits_warrant', epistemic_stance: 'confused' } },
  });

  assert.equal(state.status, 'none_open');
  assert.equal(state.elision.applied, true);
  assert.equal(state.counts.elided, 1);
  assert.equal(state.counts.open, 0);
  assert.match(state.elision.tutorInstruction, /Do not ask the learner to restate/u);
});

test('case-closing and hidden-premise debt is never elided', () => {
  const state = buildTutorStubProofDebtState({
    dagMode: 'defeasible_human_scaffold',
    warrantPremiseAudit: ordinaryMissingWarrant,
    strictDag: { assertedSecret: true, unsupportedAssertionCount: 1 },
    classification: { turn: { evidence_use: 'overleaps_evidence', epistemic_stance: 'overconfident' } },
  });

  assert.equal(state.status, 'open_proof_debt');
  assert.equal(state.elision.applied, false);
  assert.equal(state.counts.open, 1);
});
