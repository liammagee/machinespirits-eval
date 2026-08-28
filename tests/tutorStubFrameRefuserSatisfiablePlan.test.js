// GUARD: the satisfiable-condition plan build. Every job it emits must carry a
// demand the tutor can actually meet inside the outcome horizon, and the plan
// must refuse to build otherwise.
//
// The predecessor study paid for 38 dialogues before anyone noticed its demand
// was undischargeable. The point of resolving the demand at PLAN BUILD is that
// the same defect now stops before the first call rather than after the last.
//
// The other half is the hold-still check. Only one registered thing changes
// against the sealed reference: the kind of node the learner demands. If the
// reference arm, ladder, panel, stack or ceilings move, the measured 0.114 base
// rate this study is compared against stops meaning anything — so the validator
// refuses each of those, and these tests prove it refuses.
//
// Offline and free: no provider, no store, no run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1,
  buildTutorStubResistantLearnerCalibrationPlan,
  loadTutorStubResistantLearnerDesign,
  runTutorStubFrameRefuserSatisfiablePlanPreflight,
  tutorStubFrameRefuserSatisfiableRivalDagDesign,
  validateTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import { TUTOR_STUB_DEMANDED_EXHIBIT_RULE } from '../services/tutorStubRivalLearnerDag.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PATH = 'config/tutor-stub-frame-refuser-satisfiable-design.v1.json';
const load = () => loadTutorStubResistantLearnerDesign({ designPath: DESIGN_PATH, root: REPO_ROOT });
const design = () => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, DESIGN_PATH), 'utf8'));

// The demanded exhibit for each world, from the registration's tables: the
// earliest authored-path premise released after the latest trigger turn (2).
const EXPECTED_DEMAND = {
  world_005_marrick: { premise: 'p_alloy', turn: 4 },
  world_030_rowan_flat: { premise: 'p_split', turn: 3 },
};

test('the registered design validates', () => {
  const result = validateTutorStubResistantLearnerDesign(design());
  assert.deepEqual(result.issues, []);
  assert.equal(result.valid, true);
  assert.equal(design().schema, TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1);
});

test('the plan builds 48 balanced jobs, each with a dischargeable demand', () => {
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design(), { root: REPO_ROOT });
  assert.equal(plan.schema, 'machinespirits.tutor-stub.frame-refuser-satisfiable-calibration-plan.v1');
  assert.equal(plan.status, 'planned_zero_call');
  assert.equal(plan.jobs.length, 48);
  assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 48);

  for (const armId of ['treatment', 'reference']) {
    assert.equal(plan.jobs.filter((job) => job.arm_id === armId).length, 24, `${armId} must run 24 dialogues`);
    for (const world of Object.keys(EXPECTED_DEMAND)) {
      assert.equal(
        plan.jobs.filter((job) => job.arm_id === armId && job.world === world).length,
        12,
        `${armId} must run 12 dialogues in ${world}`,
      );
    }
  }

  for (const job of plan.jobs) {
    assert.equal(job.study, 'R2', 'every job runs the exhibit-minting study code');
    assert.equal(job.demanded_exhibit.rule, TUTOR_STUB_DEMANDED_EXHIBIT_RULE);
    const expected = EXPECTED_DEMAND[job.world];
    assert.equal(job.demanded_exhibit.premise_id, expected.premise);
    assert.equal(job.demanded_exhibit.release_turn, expected.turn);
    // The demand must land after the trigger and inside the horizon, which is
    // what makes it dischargeable at all.
    assert.ok(job.demanded_exhibit.release_turn > job.maximum_trigger_turn);
    assert.ok(job.demanded_exhibit.release_turn <= job.maximum_trigger_turn + job.outcome_horizon_learner_turns);
    assert.match(job.id, /^sat1_[a-z0-9_]+$/u, 'case ids are underscore-only and use the registered stem');
    assert.doesNotMatch(job.id, /^depth[-_]/u, 'a case id must not collide with an archived depth calibration');
  }
});

test('an undischargeable demand cannot reach a run, at either layer', () => {
  // Layer one: the validator holds the trigger and horizon at the sealed
  // face-B values, so widening or narrowing them never reaches a job at all.
  for (const mutate of [
    (d) => {
      d.population.outcomeHorizonPostTriggerLearnerTurns = 0;
    },
    (d) => {
      d.population.maximumTriggerLearnerTurn = 40;
    },
  ]) {
    const broken = design();
    mutate(broken);
    assert.throws(
      () => buildTutorStubResistantLearnerCalibrationPlan(broken, { root: REPO_ROOT }),
      /population drifted from the sealed face-B population/u,
    );
  }

  // Layer two: the job builder resolves the demand per world and refuses one
  // that cannot supply it. No valid design reaches that branch today — both
  // registered worlds qualify — so it is defence in depth for the next world
  // someone adds. The rule's own refusal is pinned in the mint test file; here
  // we check the builder is asking it, by proving every job carries its answer.
  const plan = buildTutorStubResistantLearnerCalibrationPlan(design(), { root: REPO_ROOT });
  assert.ok(
    plan.jobs.every((job) => job.demanded_exhibit.rule === TUTOR_STUB_DEMANDED_EXHIBIT_RULE),
    'every job records the demand the registered rule resolved for its world',
  );
});

test('the plan preflight passes zero-call and runs the design its own checks', () => {
  const preflight = runTutorStubFrameRefuserSatisfiablePlanPreflight({ loaded: load(), root: REPO_ROOT });
  assert.equal(preflight.status, 'passed_zero_call');
  assert.equal(preflight.model_calls_executed, 0);
  assert.equal(preflight.production_writes, 0);

  const failed = Object.entries(preflight.checks).filter(([, passed]) => !passed);
  assert.deepEqual(failed, [], 'every plan check must pass');
  assert.equal(preflight.mints.length, 48, 'every job is re-minted independently of the plan');

  // Both sides are independent registered constants: the per-dialogue figures
  // come from the sealed parent, the calibration totals from this design.
  assert.equal(preflight.planned_calls, 3072);
  assert.equal(preflight.registered_planned_calls, 3072);
  assert.equal(preflight.reservation_ceiling, 9504);
  assert.equal(preflight.registered_reservation_ceiling, 9504);
});

test('the concession condition resolves to the sealed one rather than a copy', () => {
  // The design records the condition as a reference so the two cannot drift.
  assert.match(String(design().population.rivalDagPersona.concessionCondition), /^unchanged from parent design faceB/u);

  const resolved = tutorStubFrameRefuserSatisfiableRivalDagDesign(design(), { root: REPO_ROOT });
  const parent = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'config/tutor-stub-resistant-learner-merged-design.v5.json'), 'utf8'),
  );
  assert.deepEqual(
    resolved.rivalDagPersona.concessionCondition,
    parent.populationStrata.faceB.rivalDagPersona.concessionCondition,
  );
});

test('the validator refuses each thing held fixed for comparability', () => {
  const refuses = (mutate, pattern) => {
    const candidate = design();
    mutate(candidate);
    const result = validateTutorStubResistantLearnerDesign(candidate);
    assert.equal(result.valid, false);
    assert.ok(
      result.issues.some((issue) => pattern.test(issue)),
      `expected an issue matching ${pattern}, got ${JSON.stringify(result.issues)}`,
    );
  };

  // The reference arm is the sealed move the 0.114 base was measured on.
  refuses((d) => {
    d.arms.reference.actionInstruction = 'reworded';
  }, /reference arm drifted/u);
  // The ladder is deliberately not amended despite the known reader split.
  refuses((d) => {
    d.measurement.ladderSource = 'clarified for the quantitative-bound boundary';
  }, /byte-identical/u);
  // The one registered change must stay the registered change.
  refuses((d) => {
    d.population.rivalDagPersona.mint.openNodeKind = 'warrant';
  }, /registered exhibit mint/u);
  refuses((d) => {
    d.population.rivalDagPersona.demandSelectionRule.id = 'first_authored_path_premise';
  }, /demand selection rule drifted/u);
  // Stack, panel, ceilings, seed, and the call-authority boundary.
  refuses((d) => {
    d.models.tutor = 'openrouter.nemotron';
  }, /model stack drifted/u);
  refuses((d) => {
    d.measurement.readerPanel.minimumPairwiseExactAgreement = 0.7;
  }, /reader panel drifted/u);
  refuses((d) => {
    d.attemptCeilings.calibrationMaximumReservations = 99999;
  }, /attempt ceilings drifted/u);
  refuses((d) => {
    d.randomization.masterSeed = 2026082901;
  }, /master seed drifted/u);
  refuses((d) => {
    d.callAuthority.grantsModelCalls = true;
  }, /call authority drifted/u);
});
