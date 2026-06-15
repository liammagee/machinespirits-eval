import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  buildLogicIR,
  buildWorldIR,
  compileGuardSpec,
  projectWorldIRLogic,
  selectGuardRepresentation,
  selectGuardRepresentationV1,
  selectGuardRepresentationV2,
  selectGuardRepresentationV3,
  summarizeGuardSpec,
} from '../services/dramaticDerivation/guardCompiler.js';
import { factKey } from '../services/dramaticDerivation/chainer.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const lantern = loadWorld('config/drama-derivation/world-002-lantern.yaml');
const marrick = loadWorld('config/drama-derivation/world-005-marrick.yaml');
const withercombe = loadWorld('config/drama-derivation/world-004-withercombe.yaml');
const hethel = loadWorld('config/drama-derivation/world-006-hethel.yaml');
const fengate = loadWorld('config/drama-derivation/world-007-fengate.yaml');
const ravensmark = loadWorld('config/drama-derivation/world-009-ravensmark.yaml');

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

test('WorldIR includes a canonical proof-hypergraph logic form', () => {
  const ir = buildWorldIR(withercombe);
  assert.equal(ir.logic.schema, 'dramatic-derivation.logic-ir.v0');
  assert.equal(ir.logic.worldId, 'world_004_withercombe');
  assert.equal(buildLogicIR(withercombe).indexes.secretFactKey, factKey(withercombe.secret.fact));

  const secretNode = ir.logic.factNodes.find((node) => node.factKey === factKey(withercombe.secret.fact));
  assert.ok(secretNode.roles.includes('secret'));
  assert.ok(secretNode.roles.includes('derived'));
  assert.deepEqual(secretNode.sourcePremiseIds, [
    'p_basin',
    'p_brought',
    'p_course',
    'p_lore',
    'p_residue',
    'p_rill',
  ]);
  assert.equal(secretNode.proof.rule, 'R3_hand');

  const foulFrom = ir.logic.factNodes.find((node) => node.factKey === factKey(['foulFrom', 'schoolWell', 'fontHouse']));
  assert.deepEqual(foulFrom.sourcePremiseIds, ['p_basin', 'p_course', 'p_rill']);
  assert.equal(foulFrom.proof.rule, 'R1_entry');

  const taintEdge = ir.logic.ruleHyperedges.find(
    (edge) => edge.outputFactKey === factKey(['taintedWith', 'schoolWell', 'wormwood']),
  );
  assert.equal(taintEdge.ruleId, 'R2_taint');
  assert.deepEqual(taintEdge.sourcePremiseIds, ['p_basin', 'p_course', 'p_lore', 'p_residue', 'p_rill']);
});

test('runtime board projection reuses the same logic form without leaking the secret early', () => {
  const ir = buildWorldIR(withercombe);
  const fact = (id) => withercombe.premiseById.get(id).fact;
  const partial = projectWorldIRLogic(ir, {
    groundedFacts: [fact('p_course'), fact('p_rill'), fact('p_basin')],
    releasedPremiseIds: ['p_course', 'p_rill', 'p_basin'],
    voicedFacts: [['foulFrom', 'schoolWell', 'fontHouse']],
    decayedPremiseIds: ['p_course'],
  });
  const partialKeys = new Set(partial.factNodes.map((node) => node.factKey));
  assert.ok(partialKeys.has(factKey(['foulFrom', 'schoolWell', 'fontHouse'])));
  assert.ok(!partialKeys.has(factKey(withercombe.secret.fact)));

  const foulFrom = partial.factNodes.find((node) => node.factKey === factKey(['foulFrom', 'schoolWell', 'fontHouse']));
  assert.equal(foulFrom.derived, true);
  assert.equal(foulFrom.voiced, true);
  assert.equal(foulFrom.decayed, true);
  assert.equal(foulFrom.proof.rule, 'R1_entry');

  const full = projectWorldIRLogic(ir, {
    groundedFacts: withercombe.proofPaths[0].premises.map(fact),
    releasedPremiseIds: withercombe.proofPaths[0].premises,
  });
  const secret = full.factNodes.find((node) => node.factKey === factKey(withercombe.secret.fact));
  assert.ok(secret);
  assert.equal(secret.derived, true);
  assert.ok(secret.roles.includes('secret'));
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

test('representation selector maps measured worlds with the one-bit topology rule', () => {
  const rows = [
    [lantern, false, 'linear_coupled_or_distractor', 'visible', '--pacing-guard-visible'],
    [marrick, true, 'forked_depth', 'hidden', '--pacing-guard'],
    [hethel, false, 'linear_coupled_or_distractor', 'visible', '--pacing-guard-visible'],
  ];

  for (const [world, independentTopLevelJoin, geometryFamily, selected, selectedFlag] of rows) {
    const decision = selectGuardRepresentation(buildWorldIR(world));
    assert.equal(decision.input.independentTopLevelJoin, independentTopLevelJoin);
    assert.equal(decision.geometryFamily, geometryFamily);
    assert.equal(decision.selected, selected);
    assert.equal(decision.selectedFlag, selectedFlag);
  }
});

test('representation selector fails closed when the topology bit is unavailable', () => {
  assert.throws(
    () => selectGuardRepresentation({ proofGraph: { secretProof: {} } }),
    /selector requires WorldIR secretProof\.independentTopLevelJoin/,
  );
});

test('representation selector v1 corrects the Withercombe decay route without losing the Hethel decoy route', () => {
  const withercombeDecay = selectGuardRepresentationV1(buildWorldIR(withercombe), { decayEnabled: true });
  assert.equal(withercombeDecay.selected, 'hidden');
  assert.equal(withercombeDecay.gate, 'decay_fail_closed_hidden');
  assert.equal(withercombeDecay.input.mirrorDeadPredicateDecoy.present, false);

  const withercombeNoDecay = selectGuardRepresentationV1(buildWorldIR(withercombe), { decayEnabled: false });
  assert.equal(withercombeNoDecay.selected, 'visible');
  assert.equal(withercombeNoDecay.gate, 'no_decay_default_visible');

  const hethelDecay = selectGuardRepresentationV1(buildWorldIR(hethel), { decayEnabled: true });
  assert.equal(hethelDecay.selected, 'visible');
  assert.equal(hethelDecay.gate, 'mirror_dead_predicate_visible');
  assert.equal(hethelDecay.input.mirrorDeadPredicateDecoy.present, true);
  assert.deepEqual(
    hethelDecay.input.mirrorDeadPredicateDecoy.candidates.map((row) => row.predicate),
    ['builtUnder', 'liableFor'],
  );
});

test('representation selector v1 still sends independent joins to hidden under decay', () => {
  const marrickDecay = selectGuardRepresentationV1(buildWorldIR(marrick), { decayEnabled: true });
  assert.equal(marrickDecay.selected, 'hidden');
  assert.equal(marrickDecay.gate, 'independent_join_hidden');

  const fengateDecay = selectGuardRepresentationV1(buildWorldIR(fengate), { decayEnabled: true });
  assert.equal(fengateDecay.selected, 'hidden');
  assert.equal(fengateDecay.gate, 'independent_join_hidden');
});

test('representation selector v2 fails closed for shared proof-critical source pressure under decay', () => {
  const hethelDecay = selectGuardRepresentationV2(buildWorldIR(hethel), { decayEnabled: true });
  assert.equal(hethelDecay.selected, 'hidden');
  assert.equal(hethelDecay.gate, 'decay_shared_source_hidden');
  assert.deepEqual(hethelDecay.input.consolidatedProofPressure.sharedCriticalSourcePremiseIds, ['p_point', 'p_surface']);
  assert.equal(hethelDecay.input.mirrorDeadPredicateDecoy.present, true);

  const withercombeDecay = selectGuardRepresentationV2(buildWorldIR(withercombe), { decayEnabled: true });
  assert.equal(withercombeDecay.selected, 'hidden');
  assert.equal(withercombeDecay.gate, 'decay_shared_source_hidden');
  assert.deepEqual(withercombeDecay.input.consolidatedProofPressure.sharedCriticalSourcePremiseIds, [
    'p_basin',
    'p_course',
    'p_rill',
  ]);
});

test('representation selector v2 preserves mirror-visible route when decay is absent', () => {
  const hethelNoDecay = selectGuardRepresentationV2(buildWorldIR(hethel), { decayEnabled: false });
  assert.equal(hethelNoDecay.selected, 'visible');
  assert.equal(hethelNoDecay.gate, 'mirror_dead_predicate_visible');
});

test('representation selector v2 routes the held-out Ravensmark decoy world to visible under decay', () => {
  const decision = selectGuardRepresentationV2(buildWorldIR(ravensmark), { decayEnabled: true });
  assert.equal(decision.selected, 'visible');
  assert.equal(decision.gate, 'mirror_dead_predicate_visible');
  assert.equal(decision.input.independentTopLevelJoin, false);
  assert.equal(decision.input.mirrorDeadPredicateDecoy.present, true);
  assert.deepEqual(
    decision.input.mirrorDeadPredicateDecoy.candidates.map((row) => row.predicate),
    ['answerableFor'],
  );
  assert.equal(decision.input.consolidatedProofPressure.proofCriticalSourcePremiseCount, 2);
  assert.equal(decision.input.consolidatedProofPressure.sharedCriticalSourcePremiseCount, 0);
});

test('representation selector v2 still sends independent joins to hidden under decay', () => {
  const fengateDecay = selectGuardRepresentationV2(buildWorldIR(fengate), { decayEnabled: true });
  assert.equal(fengateDecay.selected, 'hidden');
  assert.equal(fengateDecay.gate, 'independent_join_hidden');
});

test('representation selector v3 is hidden-default with a narrow runtime visible-stall probe', () => {
  const decision = selectGuardRepresentationV3(buildWorldIR(hethel), { decayEnabled: true });
  assert.equal(decision.schema, 'dramatic-derivation.representation-selector.v3');
  assert.equal(decision.selected, 'hidden');
  assert.equal(decision.selectedFlag, '--pacing-guard-selective-v3');
  assert.equal(decision.baseFlag, '--pacing-guard');
  assert.equal(decision.gate, 'hidden_default_visible_stall_probe');
  assert.equal(decision.runtimeVisibleProbe.enabled, true);
  assert.deepEqual(decision.runtimeVisibleProbe.acceptOnly, {
    forcedSafe: true,
    forcedBy: 'visible_stall',
    requireHiddenSafeAtCurrentTurn: true,
  });
  assert.ok(decision.runtimeVisibleProbe.reject.includes('visible_block'));
  assert.equal(decision.input.mirrorDeadPredicateDecoy.present, true);
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
