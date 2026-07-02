import assert from 'node:assert/strict';
import test from 'node:test';
import { DAG_CASES, runDagSfsAudit, scoreDagSfsRow } from '../scripts/run-plan3-dag-sfs-audit.js';

function specFor(condition) {
  const dagCase = DAG_CASES[0];
  return {
    condition,
    dagCase,
    feedback: {
      releasedEdgeId: condition === 'targeted' ? dagCase.targetEdge.id : null,
    },
  };
}

test('scoreDagSfsRow requires the exact target edge for proof-grounded recovery', () => {
  const spec = specFor('targeted');
  const score = scoreDagSfsRow(spec, {
    status: 'proved',
    claim: spec.dagCase.targetConclusion,
    used_edge_ids: ['E1', 'E2', 'E3', spec.dagCase.targetEdge.id],
    derivation: [`E3 plus ${spec.dagCase.targetEdge.id} proves ${spec.dagCase.targetConclusion}.`],
    missing_edge_ids: [],
  });

  assert.equal(score.proofGrounded, true);
  assert.equal(score.unsupportedConclusion, false);
});

test('scoreDagSfsRow rejects final-answer assertions without the target edge', () => {
  const spec = specFor('mismatched');
  const score = scoreDagSfsRow(spec, {
    status: 'proved',
    claim: spec.dagCase.targetConclusion,
    used_edge_ids: ['E1', 'E2', 'E3', spec.dagCase.mismatchedEdge.id],
    derivation: [`E1 and E2 seem enough for ${spec.dagCase.targetConclusion}.`],
    missing_edge_ids: [],
  });

  assert.equal(score.proofGrounded, false);
  assert.equal(score.unsupportedConclusion, true);
});

test('mock DAG-SFS run produces a selective proof signal', async () => {
  const result = await runDagSfsAudit({
    backend: 'mock',
    cases: DAG_CASES[0].id,
    replicates: 2,
    conditions: 'targeted,mismatched,generic,nonsense',
  });

  assert.equal(result.status, 'complete_dag_sfs');
  assert.equal(result.summary.byCondition.targeted.proofGroundedRate, 1);
  assert.equal(result.summary.falseGroundedRate, 0);
  assert.equal(result.summary.selectiveProofScore, 1);
  assert.equal(result.summary.boundary, 'proof_selective_harness_signal');
});
