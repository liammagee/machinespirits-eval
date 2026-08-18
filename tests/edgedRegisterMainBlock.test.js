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
  MAIN_BLOCK_ARM_LETTERS,
  buildEdgedRegisterCalibrationPlan,
  buildEdgedRegisterMainBlockPlan,
  fisherExactPower,
  fisherExactTwoSidedP,
  mainBlockJobs,
  mainBlockSizing,
  parseMainBlockArmSelection,
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

// ---------------------------------------------------------------------------
// Arm filter (§3.11). The three-arm block is what the signed note bought, so
// the filter has one hard duty above every other: asking for no subset, or
// asking for all three by name, must give back the frozen plan byte for byte.
// ---------------------------------------------------------------------------

// The SHA in notes/2026-08-17-edged-register-main-block-go-2.md, signed and
// launched as batch-main-2-2026-08-17. If this test fails, a signed note is
// pointing at a plan that no longer exists.
const FROZEN_MAIN_PLAN_SHA = '31b7d77bfe7832a3e8b8f729753128432760ed5d7dbf151ac85c5519d52ed607';

describe('main-block arm filter', () => {
  it('the default plan is the frozen three-arm plan and carries no subset marker', () => {
    const plan = buildEdgedRegisterMainBlockPlan();
    assert.equal(plan.planSha256, FROZEN_MAIN_PLAN_SHA);
    assert.equal(plan.armSelection, undefined);
    assert.deepEqual(
      plan.arms.map((armSpec) => armSpec.arm),
      ['A', 'B', 'C'],
    );
    assert.equal(validateEdgedRegisterMainBlockPlan(plan).ok, true);
  });

  it('naming all three arms is the frozen plan, not a fork of it', () => {
    for (const asked of ['A,B,C', 'C,B,A', ' a , b , c ']) {
      const plan = buildEdgedRegisterMainBlockPlan({ arms: asked });
      assert.equal(plan.planSha256, FROZEN_MAIN_PLAN_SHA, `--arms ${asked} forked the frozen plan`);
      assert.equal(plan.armSelection, undefined);
    }
  });

  it('the frozen harm ceiling of 700 is two reads per capped row', () => {
    const plan = buildEdgedRegisterMainBlockPlan();
    assert.equal(plan.sizing.hardCapRows, 350);
    assert.equal(plan.guardrail.screen.readerCallCeiling, 700);
    assert.equal(plan.guardrail.screen.readerCallCeiling, plan.sizing.hardCapRows * 2);
  });

  it('one arm plans 104 rows, its own cap, its own ceiling and its own SHA', () => {
    const plan = buildEdgedRegisterMainBlockPlan({ arms: 'B' });
    assert.deepEqual(
      plan.arms.map((armSpec) => armSpec.arm),
      ['B'],
    );
    assert.equal(plan.arms[0].profile, 'cell_208_id_director_edged_register_yoked_warm_delivery');
    assert.equal(plan.sizing.plannedRows, 104);
    assert.equal(plan.sizing.hardCapRows, 120);
    assert.equal(plan.guardrail.screen.readerCallCeiling, 240);
    assert.equal(plan.mainJobs.length, 104);
    assert.notEqual(plan.planSha256, FROZEN_MAIN_PLAN_SHA);
    assert.equal(validateEdgedRegisterMainBlockPlan(plan).ok, true);
  });

  it('the registered per-arm size never moves with the arm count', () => {
    for (const asked of ['A', 'A,B', 'A,B,C']) {
      const { sizing } = buildEdgedRegisterMainBlockPlan({ arms: asked });
      assert.equal(sizing.nPerArm, 104, `--arms ${asked} changed the per-arm size`);
      assert.equal(sizing.rowsPerCellPerArm, 26);
      assert.equal(sizing.baselineRate, 0.479167);
    }
  });

  it('a subset says so in the plan, with the arms it dropped', () => {
    const plan = buildEdgedRegisterMainBlockPlan({ arms: 'A,B' });
    assert.equal(plan.armSelection.subset, true);
    assert.deepEqual(plan.armSelection.requested, ['A', 'B']);
    assert.deepEqual(plan.armSelection.registered, ['A', 'B', 'C']);
    assert.match(plan.armSelection.randomisationNote, /not randomised/u);
  });

  it('the order asked for does not make a second block', () => {
    const forward = buildEdgedRegisterMainBlockPlan({ arms: 'A,C' });
    const backward = buildEdgedRegisterMainBlockPlan({ arms: 'C,A' });
    assert.equal(forward.planSha256, backward.planSha256);
    assert.deepEqual(
      forward.arms.map((armSpec) => armSpec.arm),
      ['A', 'C'],
    );
  });

  it('every subset gets a distinct SHA, so no note can launch the wrong one', () => {
    const shas = ['A', 'B', 'C', 'A,B', 'A,C', 'B,C', 'A,B,C'].map(
      (asked) => buildEdgedRegisterMainBlockPlan({ arms: asked }).planSha256,
    );
    assert.equal(new Set(shas).size, shas.length);
  });

  it('a job never carries an arm the plan dropped', () => {
    const plan = buildEdgedRegisterMainBlockPlan({ arms: 'B' });
    assert.ok(plan.mainJobs.every((job) => job.arm === 'B'));
    assert.ok(plan.mainJobs.every((job) => job.profile === plan.arms[0].profile));
    const perCell = new Map();
    for (const job of plan.mainJobs) perCell.set(job.scenario, (perCell.get(job.scenario) || 0) + 1);
    assert.equal(perCell.size, 4);
    assert.ok([...perCell.values()].every((count) => count === 26));
  });

  it('refuses an unknown, repeated or empty arm letter', () => {
    assert.throws(() => parseMainBlockArmSelection('D'), /knows only/u);
    assert.throws(() => parseMainBlockArmSelection('A,A'), /twice/u);
    assert.throws(() => parseMainBlockArmSelection(','), /no arm letters/u);
    assert.deepEqual(parseMainBlockArmSelection(''), [...MAIN_BLOCK_ARM_LETTERS]);
    assert.deepEqual(parseMainBlockArmSelection(null), [...MAIN_BLOCK_ARM_LETTERS]);
  });

  it('rejects a subset that hides that it is one', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan({ arms: 'A,B' }));
    delete plan.armSelection;
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => /armSelection\.subset/u.test(error)));
  });

  it('rejects a subset whose marker disagrees with its arms', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan({ arms: 'A,B' }));
    plan.armSelection.requested = ['A', 'C'];
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => /does not match/u.test(error)));
  });

  it('rejects a full plan wearing a subset marker', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan());
    plan.armSelection = { requested: ['A', 'B', 'C'], subset: true };
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
  });

  it('rejects scrambled arm order', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan());
    plan.arms = [plan.arms[2], plan.arms[0], plan.arms[1]];
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => /in that order/u.test(error)));
  });

  it('rejects an arm carrying another arm\'s registered profile', () => {
    const plan = copyOf(buildEdgedRegisterMainBlockPlan({ arms: 'B' }));
    plan.arms[0].profile = MAIN_GRID.arms[0].profile;
    plan.mainJobs.forEach((job) => {
      job.profile = MAIN_GRID.arms[0].profile;
    });
    const validation = validateEdgedRegisterMainBlockPlan(plan);
    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => /registered as/u.test(error)));
  });

  it('a subset batch state carries its own cap, jobs and harm ceiling', () => {
    const plan = buildEdgedRegisterMainBlockPlan({ arms: 'B' });
    const state = newMainBlockState(plan, 'batch-arm-b');
    assert.equal(state.hardCapRows, 120);
    assert.equal(stateHardCap(state), 120);
    assert.equal(state.harmReaderCallCeiling, 240);
    assert.equal(state.jobs.length, 104);
    assert.equal(state.planSha256, plan.planSha256);
    const { runnable } = enumerateRunnableJobs(state, 'main');
    assert.equal(runnable.length, 104);
  });
});
