// Guards the Stage-0 calibration plan and runner for the edged-register
// outcome study (notes/2026-08-16-edged-register-calibration-draft.md
// §2.3–§2.9): the frozen grid and plan SHA, the screen decision's drop and
// tie-break rules, confirm top-up math, the 120-row cap, the exact
// Clopper-Pearson baseline bound, the harm-guardrail families, and the
// runner's pure helpers (generation command, GO-note content check,
// attended-resume discipline). Everything here is zero-call pure logic.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  EDGED_REGISTER_CALIBRATION as GRID,
  applyRowCap,
  buildEdgedRegisterCalibrationPlan,
  clopperPearsonUpperBound,
  confirmTopUpJobs,
  decideScreenOutcome,
  harmGuardrailFindings,
  pooledKeptCellBaseline,
  validateEdgedRegisterCalibrationPlan,
} from '../services/edgedRegisterCalibration.js';
import {
  calibrationGenerationCommand,
  calibrationJobDescription,
  checkGoNoteContent,
  enumerateRunnableJobs,
  newBatchState,
  saveState,
  screenCellOutcomes,
  unresolvedGuardrailFlags,
} from '../scripts/run-edged-register-calibration.js';

const outcomesWith = (overrides = {}) =>
  GRID.cells.map((cell) => ({
    scenario: cell.scenario,
    rows: GRID.screen.rowsPerCell,
    positives: overrides[cell.scenario] ?? 2,
  }));

describe('edged-register calibration plan', () => {
  it('builds a valid plan with a stable SHA over the frozen grid + scenario bytes', () => {
    const first = buildEdgedRegisterCalibrationPlan();
    const second = buildEdgedRegisterCalibrationPlan();
    assert.match(first.planSha256, /^[0-9a-f]{64}$/);
    assert.match(first.scenarioSourceSha256, /^[0-9a-f]{64}$/);
    assert.equal(first.planSha256, second.planSha256);
    const validation = validateEdgedRegisterCalibrationPlan(first);
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.ok, true);
  });

  it('registers 12 cells and 60 cell-major screen jobs, worst case 109 <= 120', () => {
    assert.equal(GRID.cells.length, 12);
    const plan = buildEdgedRegisterCalibrationPlan();
    assert.equal(plan.screenJobs.length, 60);
    const perCell = new Map();
    for (const job of plan.screenJobs) {
      assert.equal(job.block, 'screen');
      perCell.set(job.scenario, (perCell.get(job.scenario) || 0) + 1);
    }
    for (const cell of GRID.cells) assert.equal(perCell.get(cell.scenario), 5);
    const worstCase = 60 + GRID.confirm.maxConfirmedCells * (GRID.confirm.targetRowsPerCell - GRID.screen.rowsPerCell);
    assert.equal(worstCase, 109);
    assert.ok(worstCase <= GRID.hardCapRows);
  });

  it('refuses a plan drifted onto the nemotron/kimi stack', () => {
    const plan = JSON.parse(JSON.stringify(buildEdgedRegisterCalibrationPlan()));
    plan.generation.tutorModel = 'openrouter.nemotron';
    const validation = validateEdgedRegisterCalibrationPlan(plan);
    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.includes('forbidden weak model')));
  });
});

describe('screen decision (§2.3)', () => {
  it('drops 0/5 to the floor and 5/5 to the ceiling', () => {
    const floorCell = GRID.cells[0].scenario;
    const ceilingCell = GRID.cells[1].scenario;
    const decision = decideScreenOutcome(outcomesWith({ [floorCell]: 0, [ceilingCell]: 5 }));
    assert.equal(decision.ok, true);
    assert.deepEqual(decision.droppedFloor, [floorCell]);
    assert.deepEqual(decision.droppedCeiling, [ceilingCell]);
    assert.ok(!decision.confirmed.includes(floorCell));
    assert.ok(!decision.confirmed.includes(ceilingCell));
  });

  it('breaks rate ties toward the harder persona, then authored order, capped at 7', () => {
    // All 12 cells at 2/5 (distance .1): the 4 guarded (hardness 3) and
    // 3 claimheld (hardness 2) fill the 7 slots; all 5 sustained cells
    // stay screened-but-unconfirmed.
    const decision = decideScreenOutcome(outcomesWith());
    assert.equal(decision.confirmed.length, 7);
    const hardnessOf = new Map(GRID.cells.map((cell) => [cell.scenario, cell.hardness]));
    assert.ok(decision.confirmed.every((scenario) => hardnessOf.get(scenario) >= 2));
    assert.equal(decision.screenedUnconfirmed.length, 5);
    assert.ok(decision.screenedUnconfirmed.every((scenario) => hardnessOf.get(scenario) === 1));
  });

  it('ranks distance-from-.50 before hardness', () => {
    // Push one guarded cell out to 1/5 (distance .3): it loses its slot to a
    // sustained cell at distance .1 despite being harder.
    const farGuarded = GRID.cells.find((cell) => cell.hardness === 3).scenario;
    const decision = decideScreenOutcome(outcomesWith({ [farGuarded]: 1 }));
    assert.ok(!decision.confirmed.includes(farGuarded));
    assert.equal(decision.screenedUnconfirmed.includes(farGuarded), true);
    assert.equal(decision.confirmed.length, 7);
  });

  it('fails closed on missing, extra, or under-measured cells', () => {
    const missing = decideScreenOutcome(outcomesWith().slice(1));
    assert.equal(missing.ok, false);
    assert.ok(missing.errors.some((error) => error.includes('no screen outcome supplied')));

    const underMeasured = outcomesWith();
    underMeasured[0] = { ...underMeasured[0], rows: 4, positives: 2 };
    assert.equal(decideScreenOutcome(underMeasured).ok, false);

    const extra = [...outcomesWith(), { scenario: 'not_a_cell', rows: 5, positives: 2 }];
    const extraDecision = decideScreenOutcome(extra);
    assert.equal(extraDecision.ok, false);
    assert.ok(extraDecision.errors.some((error) => error.includes('not a registered calibration cell')));
  });
});

describe('confirm top-up + row cap (§2.3, §2.7 rule 3)', () => {
  it('tops each confirmed cell from 6 to 12, ordinals from 61', () => {
    const decision = decideScreenOutcome(outcomesWith());
    const jobs = confirmTopUpJobs(decision, { startOrdinal: 61 });
    assert.equal(jobs.length, 49); // 7 cells x 7 rows
    assert.equal(jobs[0].ordinal, 61);
    assert.equal(jobs.at(-1).ordinal, 109);
    assert.deepEqual(
      jobs.slice(0, 7).map((job) => job.repeat),
      [6, 7, 8, 9, 10, 11, 12],
    );
    assert.ok(jobs.every((job) => job.block === 'confirm'));
  });

  it('rejects a decision that is not ok and a missing start ordinal', () => {
    assert.throws(() => confirmTopUpJobs({ ok: false }, { startOrdinal: 61 }));
    assert.throws(() => confirmTopUpJobs(decideScreenOutcome(outcomesWith()), {}));
  });

  it('caps paid attempts at 120 and records the overflow as deferred', () => {
    const jobs = Array.from({ length: 49 }, (_, index) => ({ ordinal: 61 + index }));
    const roomy = applyRowCap(jobs, 60);
    assert.equal(roomy.runnable.length, 49);
    assert.equal(roomy.deferred.length, 0);
    const tight = applyRowCap(jobs, 100);
    assert.equal(tight.runnable.length, 20);
    assert.equal(tight.deferred.length, 29);
    assert.throws(() => applyRowCap(jobs, -1));
  });
});

describe('pooled baseline bound (§2.4, leak G1)', () => {
  it('matches the closed forms at x=0 and x=n-1 and saturates at x=n', () => {
    // P(X <= 0; 5, p) = (1-p)^5 = 0.2  ->  p = 1 - 0.2^(1/5)
    assert.ok(Math.abs(clopperPearsonUpperBound(0, 5, 0.8) - (1 - 0.2 ** (1 / 5))) < 1e-9);
    // P(X <= 4; 5, p) = 1 - p^5 = 0.2  ->  p = 0.8^(1/5)
    assert.ok(Math.abs(clopperPearsonUpperBound(4, 5, 0.8) - 0.8 ** (1 / 5)) < 1e-9);
    assert.equal(clopperPearsonUpperBound(5, 5, 0.8), 1);
  });

  it('rises with successes and rejects malformed inputs', () => {
    const bounds = [1, 2, 3].map((successes) => clopperPearsonUpperBound(successes, 5, 0.8));
    assert.ok(bounds[0] < bounds[1] && bounds[1] < bounds[2]);
    assert.throws(() => clopperPearsonUpperBound(1.5, 5));
    assert.throws(() => clopperPearsonUpperBound(1, 0));
    assert.throws(() => clopperPearsonUpperBound(6, 5));
    assert.throws(() => clopperPearsonUpperBound(1, 5, 1));
  });

  it('pools kept cells and reports the upper 80% bound above the point rate', () => {
    const pooled = pooledKeptCellBaseline([
      { scenario: 'a', positives: 5, rows: 12 },
      { scenario: 'b', positives: 7, rows: 12 },
    ]);
    assert.equal(pooled.successes, 12);
    assert.equal(pooled.trials, 24);
    assert.equal(pooled.rate, 0.5);
    assert.ok(pooled.upperBound > 0.5 && pooled.upperBound < 1);
    assert.equal(pooled.confidence, 0.8);
    assert.equal(pooledKeptCellBaseline([]).upperBound, null);
    assert.throws(() => pooledKeptCellBaseline([{ scenario: 'a', positives: 2.5, rows: 12 }]));
  });
});

describe('harm guardrail (§2.7 rule 2, report-only)', () => {
  it('flags the three registered families and nothing on clean warm text', () => {
    const contempt = harmGuardrailFindings({ tutorMessage: 'You are lazy and you know it.' });
    assert.ok(contempt.some((finding) => finding.family === 'person_directed_contempt'));

    const shame = harmGuardrailFindings({ tutorMessage: 'That answer is camouflage for not trying.' });
    assert.ok(shame.some((finding) => finding.family === 'status_shame'));

    const coerced = harmGuardrailFindings({ postLearnerMessage: 'Sorry, I will stop asking questions.' });
    assert.ok(coerced.some((finding) => finding.family === 'coerced_uptake'));

    assert.deepEqual(
      harmGuardrailFindings({
        tutorMessage: 'Which part of the fraction felt slippery just now?',
        postLearnerMessage: 'The denominator part, I think — can we slow down there?',
      }),
      [],
    );
  });
});

describe('calibration runner pure helpers', () => {
  it('composes the per-job generation command on the pinned stack', () => {
    const plan = buildEdgedRegisterCalibrationPlan();
    const job = plan.screenJobs[0];
    const command = calibrationGenerationCommand(job, { batchId: 'batch-1', attempt: 1 });
    assert.equal(command[1], 'scripts/eval-cli.js');
    assert.equal(command[2], 'run');
    // --skip-rubric takes no value, so read each flag's value by position.
    const flags = new Map();
    for (let index = 3; index < command.length; index += 1) {
      if (command[index].startsWith('--')) flags.set(command[index], command[index + 1]);
    }
    assert.equal(flags.get('--profiles'), GRID.profile);
    assert.equal(flags.get('--scenario'), job.scenario);
    assert.equal(flags.get('--runs'), '1');
    assert.equal(flags.get('--parallelism'), '1');
    assert.equal(flags.get('--tutor-model'), 'codex.gpt-5.6-luna');
    assert.equal(flags.get('--learner-model'), 'codex.gpt-5.6-luna');
    assert.equal(flags.get('--description'), calibrationJobDescription('batch-1', job, 1));
    assert.ok(command.includes('--skip-rubric'));
  });

  it('accepts a GO note only when it carries the plan SHA and says GO', () => {
    const sha = 'a'.repeat(64);
    assert.equal(checkGoNoteContent(`GO\nplan ${sha}`, sha).ok, true);
    assert.equal(checkGoNoteContent(`go quietly ${sha}`, sha).ok, false);
    assert.equal(checkGoNoteContent('GO but no sha', sha).ok, false);
  });

  it('starts a batch with 60 pending screen jobs carrying the plan SHA', () => {
    const plan = buildEdgedRegisterCalibrationPlan();
    const state = newBatchState(plan, 'batch-1');
    assert.equal(state.jobs.length, 60);
    assert.ok(state.jobs.every((job) => job.status === 'pending' && job.attempts.length === 0));
    assert.equal(state.planSha256, plan.planSha256);
    assert.equal(state.rowsAttempted, 0);
  });

  it('enforces the attended-resume discipline: two attempts need an operator ruling', () => {
    const state = newBatchState(buildEdgedRegisterCalibrationPlan(), 'batch-1');
    state.jobs[0].status = 'completed';
    state.jobs[1].status = 'failed';
    state.jobs[1].attempts = [{ attempt: 1 }, { attempt: 2 }];
    state.jobs[2].status = 'killed_cell';
    state.jobs[3].status = 'failed';
    state.jobs[3].attempts = [{ attempt: 1 }];
    const { runnable, needsRuling } = enumerateRunnableJobs(state, 'screen');
    assert.equal(needsRuling.length, 1);
    assert.equal(needsRuling[0].ordinal, state.jobs[1].ordinal);
    assert.ok(!runnable.some((job) => job.ordinal === state.jobs[0].ordinal));
    assert.ok(!runnable.some((job) => job.ordinal === state.jobs[2].ordinal));
    assert.ok(runnable.some((job) => job.ordinal === state.jobs[3].ordinal));
    assert.equal(runnable.length, 57);
  });

  it('screen outcomes fail closed until all 60 rows are classified', () => {
    const state = newBatchState(buildEdgedRegisterCalibrationPlan(), 'batch-1');
    const positiveByRowId = new Map();
    for (const job of state.jobs) {
      job.status = 'completed';
      job.rowId = 1000 + job.ordinal;
      positiveByRowId.set(job.rowId, job.repeat <= 2); // 2/5 per cell
    }
    const complete = screenCellOutcomes(state, positiveByRowId);
    assert.deepEqual(complete.errors, []);
    assert.equal(complete.outcomes.length, 12);
    assert.ok(complete.outcomes.every((cell) => cell.rows === 5 && cell.positives === 2));

    state.jobs[7].status = 'pending';
    const incomplete = screenCellOutcomes(state, positiveByRowId);
    assert.ok(incomplete.errors.length >= 1);
  });

  it('counts only unresolved guardrail flags', () => {
    const state = newBatchState(buildEdgedRegisterCalibrationPlan(), 'batch-1');
    state.guardrailFlags = [
      { ordinal: 1, resolution: null },
      { ordinal: 2, resolution: { decision: 'resume_unchanged' } },
    ];
    assert.equal(unresolvedGuardrailFlags(state).length, 1);
  });
});

// §2.14: the operator records a ruling in a second process while the runner is
// still alive. A whole-object save from the runner's stale memory used to erase
// it. Every case below is that race, played out in one temp directory.
describe('edged-register state save keeps an operator ruling', () => {
  const withBatchDir = (fn) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edged-state-'));
    try {
      fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  // The runner saved, the operator then ruled on disk; `runner` is the stale
  // in-memory copy that has never seen the ruling.
  const raceSetup = (dir, rule) => {
    const runner = newBatchState(buildEdgedRegisterCalibrationPlan(), 'batch-1');
    runner.guardrailFlags = [{ ordinal: 1, scenario: runner.jobs[0].scenario, resolution: null }];
    saveState(dir, runner);
    const operator = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    rule(operator);
    fs.writeFileSync(path.join(dir, 'state.json'), `${JSON.stringify(operator, null, 2)}\n`);
    return runner;
  };

  const reread = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));

  it('carries a resume_unchanged ruling through the runner next save', () => {
    withBatchDir((dir) => {
      const record = { decision: 'resume_unchanged', detail: null, recordedAt: '2026-08-17T00:00:00.000Z' };
      const runner = raceSetup(dir, (operator) => {
        operator.operatorDecisions.push(record);
        operator.guardrailFlags[0].resolution = record;
      });

      runner.rowsAttempted += 1; // any ordinary runner write
      saveState(dir, runner);

      const saved = reread(dir);
      assert.deepEqual(saved.operatorDecisions, [record]);
      assert.deepEqual(saved.guardrailFlags[0].resolution, record);
      assert.equal(saved.rowsAttempted, 1);
      assert.equal(unresolvedGuardrailFlags(runner).length, 0, 'the live runner also sees the ruling');
    });
  });

  it('carries kill_study through, and the live runner stops taking jobs', () => {
    withBatchDir((dir) => {
      const runner = raceSetup(dir, (operator) => {
        operator.killed = true;
        operator.operatorDecisions.push({
          decision: 'kill_study',
          detail: null,
          recordedAt: '2026-08-17T00:00:01.000Z',
        });
      });

      saveState(dir, runner);

      assert.equal(reread(dir).killed, true);
      assert.equal(runner.killed, true, 'takeJob() reads this and stops');
    });
  });

  it('carries kill_cell through but never downgrades a row already generated', () => {
    withBatchDir((dir) => {
      const runner = raceSetup(dir, (operator) => {
        for (const job of operator.jobs) {
          if (job.scenario === operator.jobs[0].scenario) job.status = 'killed_cell';
        }
      });
      // The runner finished one row of that cell before the ruling landed. It
      // was paid for, so it stays completed; only unstarted work is killed.
      runner.jobs[0].status = 'completed';

      saveState(dir, runner);

      const saved = reread(dir);
      assert.equal(saved.jobs[0].status, 'completed');
      const sameCell = saved.jobs.filter((job) => job.scenario === saved.jobs[0].scenario);
      assert.ok(sameCell.length > 1);
      assert.ok(sameCell.slice(1).every((job) => job.status === 'killed_cell'));
    });
  });

  it('does not duplicate a ruling the runner already holds', () => {
    withBatchDir((dir) => {
      const record = { decision: 'resume_unchanged', detail: null, recordedAt: '2026-08-17T00:00:02.000Z' };
      const runner = raceSetup(dir, (operator) => operator.operatorDecisions.push(record));

      saveState(dir, runner);
      saveState(dir, runner);

      assert.deepEqual(reread(dir).operatorDecisions, [record]);
    });
  });

  it('ignores a state file belonging to a different batch', () => {
    withBatchDir((dir) => {
      const runner = raceSetup(dir, (operator) => {
        operator.batchId = 'batch-other';
        operator.killed = true;
      });

      saveState(dir, runner);

      assert.equal(reread(dir).killed, false);
    });
  });
});
