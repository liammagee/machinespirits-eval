// GUARD: the R2 exhibit mint stays dischargeable, and the B1/R1 mints stay
// byte-identical. The registered design is
// config/tutor-stub-frame-refuser-satisfiable-design.v1.json; the derivation
// it rests on is notes/2026-08-28-frame-refuser-satisfiable-registration.md.
//
// The predecessor study's demand was undischargeable by construction: the R1
// mint hands the learner rule glosses, and a rule's satisfaction is its
// consequent — a derived fact no world premise witnesses. The R2 mint hands it
// the authored path's premises instead: exhibits the record can hold. These
// tests pin both halves — the new demand can be met, the old ones could not —
// and that adding R2 changed nothing about B1 or R1.
//
// Offline and free: no provider, no store, no run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_DEMANDED_EXHIBIT_RULE,
  mintTutorStubRivalLearnerDag,
  evaluateTutorStubRivalDagConcession,
  selectTutorStubDemandedExhibit,
} from '../services/tutorStubRivalLearnerDag.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { matchPattern } from '../services/dramaticDerivation/chainer.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8'));

const SATISFIABLE = readJson('config/tutor-stub-frame-refuser-satisfiable-design.v1.json');
const PARENT = readJson('config/tutor-stub-resistant-learner-merged-design.v5.json');

// The registration's per-world tables, verbatim: authored-path premises in
// release order, with their scheduled release turns.
const EXPECTED = {
  world_030_rowan_flat: [
    ['p_split', 3],
    ['p_pressure', 5],
    ['p_dye', 7],
  ],
  world_005_marrick: [
    ['p_alloy', 4],
    ['p_crucible', 8],
    ['p_caster', 10],
    ['p_flaw', 14],
    ['p_graver', 18],
    ['p_holder', 22],
  ],
};

function worldFile(worldId) {
  return loadWorld(path.join(REPO_ROOT, 'config', 'drama-derivation', `${worldId.replace(/_/gu, '-')}.yaml`));
}

// The design registers its concession condition as "unchanged from parent
// design faceB"; resolve that reference the way the plan build will.
function exhibitDesign() {
  return {
    randomization: SATISFIABLE.randomization,
    rivalDagPersona: {
      ...SATISFIABLE.population.rivalDagPersona,
      concessionCondition: PARENT.populationStrata.faceB.rivalDagPersona.concessionCondition,
    },
  };
}

function warrantDesign() {
  return {
    randomization: PARENT.randomization,
    rivalDagPersona: PARENT.populationStrata.faceB.rivalDagPersona,
  };
}

function mint(study, world, design) {
  return mintTutorStubRivalLearnerDag({
    design,
    job: { id: `sat1_mint_check_${world}`, study, world },
    root: REPO_ROOT,
  });
}

test('the R2 mint yields exhibit nodes from the authored path premises, in release order', () => {
  for (const [worldId, expected] of Object.entries(EXPECTED)) {
    const world = worldFile(worldId);
    const dag = mint('R2', worldId, exhibitDesign());
    assert.equal(dag.relation, 'standing_rivalry_over_exhibits');
    assert.equal(dag.openNodes.length, expected.length, `${worldId} must open one node per authored-path premise`);
    const authoredPremises = new Set(world.proofPaths[0].premises);
    dag.openNodes.forEach((node, index) => {
      const [premiseId, releaseTurn] = expected[index];
      assert.equal(node.openNodeKind, 'exhibit');
      assert.equal(node.sourcePremiseId, premiseId, `${worldId} node ${index + 1} must demand ${premiseId}`);
      assert.equal(node.releaseTurn, releaseTurn);
      assert.ok(authoredPremises.has(premiseId), `${premiseId} must sit on the authored proof path`);
      // The demand is the premise's authored surface — a thing the record can
      // hold — never a rule gloss.
      assert.equal(node.task, String(world.premiseById.get(premiseId).surface).trim());
    });
    // Downstream machinery accepts exhibit nodes unchanged.
    const concession = evaluateTutorStubRivalDagConcession({ dag, history: [] });
    assert.equal(concession.eligible, false);
    assert.equal(concession.nextOpenNodeId, dag.openNodes[0].id);
  }
});

test('the registered demand selection rule yields a dischargeable demand at every eligible trigger turn', () => {
  const { maximumTriggerLearnerTurn, outcomeHorizonPostTriggerLearnerTurns } = SATISFIABLE.population;
  const firstDemand = { world_030_rowan_flat: 'p_split', world_005_marrick: 'p_alloy' };
  for (const worldId of SATISFIABLE.population.worlds) {
    const dag = mint('R2', worldId, exhibitDesign());
    for (let triggerTurn = 1; triggerTurn <= maximumTriggerLearnerTurn; triggerTurn += 1) {
      const demand = selectTutorStubDemandedExhibit({
        dag,
        triggerTurn,
        outcomeHorizonPostTriggerLearnerTurns,
      });
      assert.equal(demand.rule, TUTOR_STUB_DEMANDED_EXHIBIT_RULE);
      assert.equal(demand.demandedPremiseId, firstDemand[worldId]);
      assert.ok(demand.releaseTurn > triggerTurn, 'the demanded exhibit must not already be public');
      assert.ok(
        demand.releaseTurn <= triggerTurn + outcomeHorizonPostTriggerLearnerTurns,
        'the demanded exhibit must arrive inside the outcome horizon',
      );
    }
  }
});

test('the demand selection rule fails closed when no premise can qualify', () => {
  const dag = mint('R2', 'world_030_rowan_flat', exhibitDesign());
  // Past the last scheduled release: everything is already public.
  assert.throws(
    () => selectTutorStubDemandedExhibit({ dag, triggerTurn: 30, outcomeHorizonPostTriggerLearnerTurns: 8 }),
    /refuse this world/u,
  );
  // A trigger at the last release turn with nothing later inside the horizon.
  assert.throws(
    () => selectTutorStubDemandedExhibit({ dag, triggerTurn: 7, outcomeHorizonPostTriggerLearnerTurns: 8 }),
    /refuse this world/u,
  );
});

test('an R2 job refuses a design that does not register the exhibit mint', () => {
  // Running the new study code against the predecessor's design (or the new
  // design against the old mint) must fail before any node is minted, per the
  // design's mint_not_implemented risk disposition.
  assert.throws(() => mint('R2', 'world_030_rowan_flat', warrantDesign()), /openNodeKind is "exhibit"/u);
});

test('the R1 warrant mint is byte-identical and its demand stays undischargeable', () => {
  for (const worldId of SATISFIABLE.population.worlds) {
    const world = worldFile(worldId);
    const dag = mint('R1', worldId, warrantDesign());
    assert.equal(dag.relation, 'standing_rivalry');
    for (const node of dag.openNodes) {
      // Exactly the predecessor's node shape: adding R2 must not have leaked
      // new fields into the sealed R1 mint.
      assert.deepEqual(Object.keys(node), ['id', 'sourceRuleId', 'task', 'status']);
    }
    // The finding the R2 design rests on, checked mechanically: no world
    // premise witnesses any consequent of any authored-path rule. That is why
    // the R1 demand could never be discharged, in either world.
    const ruleById = new Map(world.rules.map((rule) => [rule.id, rule]));
    for (const ruleId of dag.authoredRuleIds) {
      for (const consequent of ruleById.get(ruleId).then) {
        for (const premise of world.premises) {
          assert.equal(
            matchPattern(consequent, premise.fact),
            null,
            `premise ${premise.id} witnesses the consequent of ${ruleId}; the R1 undischargeability finding no longer holds for ${worldId}`,
          );
        }
      }
    }
  }
  // The registration's worked case, verbatim.
  const rowan = mint('R1', 'world_030_rowan_flat', warrantDesign());
  assert.equal(rowan.openNodes[0].id, 'open_1_R1_release');
});

test('the B1 premise mint is byte-identical', () => {
  const design = warrantDesign();
  design.rivalDagPersona = {
    ...design.rivalDagPersona,
    mint: { worldPool: ['world_005_marrick', 'world_030_rowan_flat'] },
  };
  const dag = mint('B1', 'world_005_marrick', design);
  assert.equal(dag.relation, 'content_rivalry');
  for (const node of dag.openNodes) {
    assert.deepEqual(Object.keys(node), ['id', 'sourcePremiseId', 'task', 'status']);
  }
});
