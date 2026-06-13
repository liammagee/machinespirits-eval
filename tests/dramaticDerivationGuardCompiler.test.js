import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildWorldIR, compileGuardSpec, summarizeGuardSpec } from '../services/dramaticDerivation/guardCompiler.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const lantern = loadWorld('config/drama-derivation/world-002-lantern.yaml');
const marrick = loadWorld('config/drama-derivation/world-005-marrick.yaml');

function withRuleIf(world, ruleId, nextIf) {
  return {
    ...world,
    rules: world.rules.map((rule) => (rule.id === ruleId ? { ...rule, if: nextIf } : rule)),
  };
}

test('WorldIR captures Marrick as a disjoint top-level join', () => {
  const ir = buildWorldIR(marrick);
  assert.equal(ir.schema, 'dramatic-derivation.guard-compiler.v0.world-ir');
  assert.equal(ir.world.id, 'world_005_marrick');
  assert.equal(ir.proofGraph.secretProof.independentTopLevelJoin, true);
  assert.equal(ir.proofGraph.secretProof.topBranches.length, 2);
  assert.deepEqual(
    ir.proofGraph.secretProof.topBranches.map((branch) => branch.basePremiseIds),
    [
      ['p_alloy', 'p_caster', 'p_crucible'],
      ['p_flaw', 'p_graver', 'p_holder'],
    ],
  );
});

test('WorldIR does not falsely classify lantern as a disjoint join', () => {
  const ir = buildWorldIR(lantern);
  assert.equal(ir.world.id, 'world_002_lantern');
  assert.equal(ir.proofGraph.secretProof.independentTopLevelJoin, false);
  assert.ok(ir.proofGraph.secretProof.branchOverlap.length >= 1);
});

test('GuardSpec emits hidden pacing corridors and a narrow proof-debt tutor view', () => {
  const spec = compileGuardSpec(marrick, buildWorldIR(marrick));
  assert.equal(spec.schema, 'dramatic-derivation.guard-compiler.v0.guard-spec');
  assert.equal(spec.compiler.onlineLlmGuardAuthoring, false);
  assert.deepEqual(spec.guards.proof_debt.exposeToTutor, ['premiseId', 'surface', 'sinceTurn']);
  assert.ok(spec.guards.proof_debt.forbid.includes('D_arithmetic'));
  assert.ok(spec.guards.proof_debt.forbid.includes('secret'));
  assert.deepEqual(
    spec.guards.hidden_pacing.releaseCorridors.map((row) => row.premise),
    ['p_alloy', 'p_crucible', 'p_flaw', 'p_graver'],
  );
});

test('GuardSpec marks Marrick visible projection as a topology risk', () => {
  const spec = compileGuardSpec(marrick, buildWorldIR(marrick));
  assert.equal(spec.guards.visible_projection.status, 'uncertified_topology_risk');
  assert.ok(spec.guards.visible_projection.forbiddenInputs.includes('proof_distance'));
  assert.ok(spec.guards.visible_projection.forbiddenInputs.includes('proof_path'));
  assert.ok(spec.guards.visible_projection.validation.compareToHiddenReference);
});

test('GuardSpec keeps lantern visible projection replay-gated rather than globally certified', () => {
  const spec = compileGuardSpec(lantern, buildWorldIR(lantern));
  assert.equal(spec.guards.visible_projection.status, 'candidate_requires_replay');
  assert.ok(spec.guards.visible_projection.validation.compareToHiddenReference);
});

test('summarizeGuardSpec exposes the report-level P1 signals', () => {
  const summary = summarizeGuardSpec(compileGuardSpec(marrick, buildWorldIR(marrick)));
  assert.equal(summary.worldId, 'world_005_marrick');
  assert.equal(summary.hiddenPacingPremises, 4);
  assert.equal(summary.visibleProjectionStatus, 'uncertified_topology_risk');
  assert.deepEqual(summary.proofDebtTutorView, ['premiseId', 'surface', 'sinceTurn']);
});

test('mutating Marrick to remove the disjoint join downgrades visible topology risk', () => {
  const overlappedMarrick = withRuleIf(marrick, 'R5_strike', [
    ['castBlankFor', '?coin', '?x'],
    ['blankFrom', '?coin', '?crucible'],
  ]);
  const ir = buildWorldIR(overlappedMarrick);
  assert.equal(ir.proofGraph.secretProof.independentTopLevelJoin, false);
  assert.equal(compileGuardSpec(overlappedMarrick, ir).guards.visible_projection.status, 'candidate_requires_replay');
});

test('mutating lantern into a disjoint top-level join upgrades visible topology risk', () => {
  const disjointLantern = withRuleIf(lantern, 'R4_light', [
    ['steeredByLampOf', '?ship', '?t'],
    ['onlyKeyTo', '?t', '?x'],
  ]);
  const ir = buildWorldIR(disjointLantern);
  assert.equal(ir.proofGraph.secretProof.independentTopLevelJoin, true);
  assert.equal(compileGuardSpec(disjointLantern, ir).guards.visible_projection.status, 'uncertified_topology_risk');
});

test('committed guard-compiler artifacts match regenerated output', () => {
  const result = spawnSync(process.execPath, ['scripts/derivation-guard-compiler.js', '--check'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
