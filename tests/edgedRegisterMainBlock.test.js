// Guards the main-block plan and runner support for the edged-register
// outcome study (notes/2026-08-16-edged-register-calibration-draft.md
// Part 3): the frozen three-arm grid over the four kept cells, the exact
// Fisher test and its power scan (104 per arm from the frozen 23/48
// baseline and the registered +20 points), dozen-wise arm×cell
// interleaving, the per-job profile in the generation command, the
// state-carried hard cap, and the validator's fail-closed checks.
// Everything here is zero-call pure logic plus local file reads.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EDGED_REGISTER_CALIBRATION as GRID,
  EDGED_REGISTER_MAIN_BLOCK as MAIN_GRID,
  buildEdgedRegisterCalibrationPlan,
  buildEdgedRegisterMainBlockPlan,
  fisherExactPower,
  fisherExactTwoSidedP,
  mainBlockJobs,
  mainBlockSizing,
  validateEdgedRegisterMainBlockPlan,
} from '../services/edgedRegisterCalibration.js';
import {
  calibrationGenerationCommand,
  enumerateRunnableJobs,
  newBatchState,
  newMainBlockState,
  stateHardCap,
} from '../scripts/run-edged-register-calibration.js';

const KEPT_SCENARIOS = [
  'charisma_desire_resistance_breakthrough_question_flood_sustained',
  'charisma_desire_resistance_breakthrough_rote_parroting_sustained',
  'charisma_desire_resistance_breakthrough_boredom_claimheld',
  'charisma_desire_resistance_breakthrough_rote_parroting_guarded',
];

const copyOf = (value) => JSON.parse(JSON.stringify(value));

describe('main-block grid (Part 3 registration)', () => {
  it('freezes the four kept cells, three arms, and the 23/48 baseline', () => {
    assert.deepEqual(MAIN_GRID.cells.map((cell) => cell.scenario).sort(), [...KEPT_SCENARIOS].sort());
    assert.deepEqual(
      MAIN_GRID.arms.map((armSpec) => armSpec.arm),
      ['A', 'B', 'C'],
    );
    assert.equal(MAIN_GRID.arms[2].profile, GRID.profile); // arm C is byte-identical to calibration
    assert.deepEqual(MAIN_GRID.baseline, { successes: 23, trials: 48 });
    assert.equal(MAIN_GRID.powering.minimumEffect, 0.2);
    assert.equal(MAIN_GRID.generation.lanes, GRID.generation.lanes);
    assert.equal(MAIN_GRID.endpoint.readerCallsPerRow, 1);
  });

  it('builds a valid plan with a stable SHA', () => {
    const first = buildEdgedRegisterMainBlockPlan();
    const second = buildEdgedRegisterMainBlockPlan();
    assert.match(first.planSha256, /^[0-9a-f]{64}$/);
    assert.equal(first.planSha256, second.planSha256);
    assert.notEqual(first.planSha256, buildEdgedRegisterCalibrationPlan().planSha256);
    const validation = validateEdgedRegisterMainBlockPlan(first);
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.ok, true);
  });
});

describe('Fisher exact test', () => {
  it('matches hand-computed two-sided values on small tables', () => {
    // 3/4 vs 1/4: table probs 1,16,36,16,1 over 70; two-sided = 34/70.
    assert.ok(Math.abs(fisherExactTwoSidedP(3, 4, 1, 4) - 34 / 70) < 1e-9);
    // A symmetric table can never look extreme (sum of all tables, so
    // floating-point puts it a hair under exactly 1).
    assert.ok(Math.abs(fisherExactTwoSidedP(2, 4, 2, 4) - 1) < 1e-9);
    // 4/4 vs 0/4: the two extreme tables, 2/70.
    assert.ok(Math.abs(fisherExactTwoSidedP(4, 4, 0, 4) - 2 / 70) < 1e-9);
  });

  it('rejects malformed counts', () => {
    assert.throws(() => fisherExactTwoSidedP(5, 4, 0, 4));
    assert.throws(() => fisherExactTwoSidedP(-1, 4, 0, 4));
  });

  it('keeps its size under alpha at the null', () => {
    const rate = MAIN_GRID.baseline.successes / MAIN_GRID.baseline.trials;
    assert.ok(fisherExactPower(48, rate, rate, 0.05) <= 0.05);
  });
});

describe('exact-test sizing (§3.2, GO-note re-computation)', () => {
  it('lands on 104 per arm / 26 per cell / 312 rows / cap 350', () => {
    const sizing = mainBlockSizing();
    assert.equal(sizing.nPerArm, 104);
    assert.equal(sizing.nPerArm % MAIN_GRID.cells.length, 0); // even split forces multiples of 4
    assert.equal(sizing.rowsPerCellPerArm, 26);
    assert.equal(sizing.plannedRows, 312);
    assert.equal(sizing.hardCapRows, 350);
    assert.ok(sizing.powerAtN >= 0.8);
    assert.ok(sizing.powerAtNextLower < 0.8); // 100 per arm fails at .79
    assert.ok(Math.abs(sizing.baselineRate - 23 / 48) < 1e-6);
    assert.ok(Math.abs(sizing.targetRate - (23 / 48 + 0.2)) < 1e-6);
  });
});

describe('main-block jobs', () => {
  it('interleaves the three arms dozen-wise over the four cells', () => {
    const jobs = mainBlockJobs(mainBlockSizing());
    assert.equal(jobs.length, 312);
    assert.deepEqual(
      jobs.map((job) => job.ordinal),
      Array.from({ length: 312 }, (_, index) => index + 1),
    );
    for (let dozen = 0; dozen < 26; dozen += 1) {
      const window = jobs.slice(dozen * 12, dozen * 12 + 12);
      const pairs = new Set(window.map((job) => `${job.arm}|${job.scenario}`));
      assert.equal(pairs.size, 12); // every consecutive dozen covers all arm×cell pairs
    }
    const perPair = new Map();
    const armProfiles = new Map(MAIN_GRID.arms.map((armSpec) => [armSpec.arm, armSpec.profile]));
    for (const job of jobs) {
      assert.equal(job.block, 'main');
      assert.equal(job.profile, armProfiles.get(job.arm));
      const key = `${job.arm}|${job.scenario}`;
      perPair.set(key, (perPair.get(key) || 0) + 1);
    }
    assert.equal(perPair.size, 12);
    for (const count of perPair.values()) assert.equal(count, 26);
  });
});

describe('main-block plan validation (fail-closed)', () => {
  it('rejects a drifted arm profile', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan());
    plan.arms[2].profile = 'cell_1_base_single_unified';
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
  });

  it('rejects an underpowered size', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan());
    plan.sizing.nPerArm = 100;
    plan.sizing.rowsPerCellPerArm = 25;
    plan.sizing.plannedRows = 300;
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
  });

  it('rejects a tampered baseline', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan());
    plan.baseline.successes = 24;
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
  });

  it('rejects tampered jobs', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan());
    plan.mainJobs[0].arm = 'B'; // now uneven per arm×cell
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
  });

  it('rejects a drift onto the nemotron/kimi stack', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan());
    plan.generation.tutorModel = 'openrouter.nemotron';
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
  });
});

describe('runner main-block support', () => {
  it('generation command uses the job profile for main jobs, grid profile for calibration jobs', () => {
    const plan = buildEdgedRegisterMainBlockPlan();
    const mainCommand = calibrationGenerationCommand(plan.mainJobs[0], { batchId: 'b', attempt: 1 });
    assert.equal(mainCommand[mainCommand.indexOf('--profiles') + 1], MAIN_GRID.arms[0].profile);
    const calibrationJob = { ordinal: 1, block: 'screen', scenario: KEPT_SCENARIOS[0] };
    const calibrationCommand = calibrationGenerationCommand(calibrationJob, { batchId: 'b', attempt: 1 });
    assert.equal(calibrationCommand[calibrationCommand.indexOf('--profiles') + 1], GRID.profile);
  });

  it('newMainBlockState carries the plan cap and 312 pending main jobs', () => {
    const plan = buildEdgedRegisterMainBlockPlan();
    const state = newMainBlockState(plan, 'batch-x');
    assert.equal(state.schema, 'machinespirits.edged-register-main-block-state.v1');
    assert.equal(state.hardCapRows, 350);
    assert.equal(stateHardCap(state), 350);
    assert.equal(state.jobs.length, 312);
    assert.ok(state.jobs.every((job) => job.block === 'main' && job.status === 'pending'));
    assert.deepEqual(state.arms, plan.arms);
    const { runnable, needsRuling } = enumerateRunnableJobs(state, 'main');
    assert.equal(runnable.length, 312);
    assert.equal(needsRuling.length, 0);
  });

  it('calibration states still run under the grid cap of 120', () => {
    const state = newBatchState(buildEdgedRegisterCalibrationPlan(), 'batch-y');
    assert.equal(state.hardCapRows, undefined);
    assert.equal(stateHardCap(state), GRID.hardCapRows);
  });

  it('a main job that burned both attempts needs an operator ruling', () => {
    const plan = buildEdgedRegisterMainBlockPlan();
    const state = newMainBlockState(plan, 'batch-z');
    state.jobs[0].status = 'failed';
    state.jobs[0].attempts = [{ attempt: 1 }, { attempt: 2 }];
    const { runnable, needsRuling } = enumerateRunnableJobs(state, 'main');
    assert.equal(runnable.length, 311);
    assert.equal(needsRuling.length, 1);
    assert.equal(needsRuling[0].ordinal, state.jobs[0].ordinal);
  });
});
