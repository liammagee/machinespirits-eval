#!/usr/bin/env node
/**
 * Zero-call launch simulation for the guarded main block.
 *
 * The driver has no plan-only mode: the only way past its guards is to launch
 * and pay. So this script runs the guard chain on its own — read the manifest,
 * bind it to a run size, check a GO note against that size, open a budget — and
 * stops before the first call. Nothing here can spend, because no dialogue
 * runner and no reader process is ever handed over.
 *
 * What it proves:
 *   1. the sealed main-block manifest binds to the main-block size,
 *   2. the pilot's own GO note cannot launch it,
 *   3. --shape pilot cannot launch it,
 *   4. a checkpoint from the pilot cannot be resumed into it,
 *   5. the budget opens at zero calls with the 4,464-call plan.
 *
 * A note supplied with --go-note is checked too, and the artifact records
 * whether it would be accepted. A note supplied with --held-go-note is checked
 * the other way round: it must be refused, which is what a launch note written
 * before its approval is for. Without either, the refusal is the finding: today
 * nothing can launch this block.
 *
 * The two flags cannot both be passed. Which expectation applies is a fact
 * about the note, not something to read off the result — a check that accepted
 * either outcome would pass whatever the bytes said.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  OUTCOME_CAMPAIGN_CALL_CEILING,
  assertOutcomeCheckpointShape,
  assertOutcomeShapeFlag,
  createOutcomePilotBudget,
  validateOutcomePilotGoNote,
  verifyOutcomePilotManifestBindings,
} from './run-adaptive-warrant-outcome-pilot.js';
import { OUTCOME_RUN_SHAPES } from './prepare-adaptive-warrant-outcome-study.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GUARDED_MAIN_BLOCK_MANIFEST =
  'docs/adaptation-refinement/guarded-main-block/guarded-main-block-manifest.json';
export const GUARDED_PILOT_GO_NOTE = 'docs/adaptation-refinement/relay/113-go-guarded-pilot.md';
export const LAUNCH_SIMULATION_SCHEMA = 'machinespirits.adaptation-refinement.guarded-main-block-launch-simulation.v1';

/** A check that must throw. Passing means the guard held; not throwing is the failure. */
function expectRefusal(name, expectation, run) {
  try {
    run();
    return { name, expectation, held: false, detail: 'the guard let this through' };
  } catch (error) {
    return { name, expectation, held: true, detail: error.message };
  }
}

/** A check that must not throw. */
function expectPass(name, expectation, run) {
  try {
    const detail = run();
    return { name, expectation, held: true, detail: detail || 'accepted' };
  } catch (error) {
    return { name, expectation, held: false, detail: error.message };
  }
}

export function simulateGuardedMainBlockLaunch({
  manifestPath = GUARDED_MAIN_BLOCK_MANIFEST,
  pilotGoNotePath = GUARDED_PILOT_GO_NOTE,
  goNotePath = null,
  heldGoNotePath = null,
  learnerProfile = 'overconfident',
  // The run directory of a stopped run, to simulate a restart rather than a
  // first launch. The launcher reads the same checkpoint for the same reason.
  resumeRunDir = null,
} = {}) {
  if (goNotePath && heldGoNotePath) {
    throw new Error('simulation refuses: a note is either expected to launch or expected to be refused, not both');
  }
  const resolvedManifest = path.resolve(ROOT, manifestPath);
  const resumeCheckpoint = resumeRunDir
    ? JSON.parse(fs.readFileSync(path.join(path.resolve(ROOT, resumeRunDir), 'outcome-pilot-checkpoint.json'), 'utf8'))
    : null;
  const guarded = verifyOutcomePilotManifestBindings({
    manifestPath: resolvedManifest,
    expectedLearnerProfile: learnerProfile,
    recordedGuard: resumeCheckpoint?.pre_call_guards?.prepared_identity ?? null,
  });
  const shape = guarded.shape;
  const plan = guarded.manifest.planned_calls;

  const checks = [
    expectPass('manifest_binds_to_main_block', 'the sealed manifest reads as a main-block run', () => {
      if (shape.name !== 'main-block') throw new Error(`manifest bound to ${shape.name}`);
      return `${shape.dialogues} dialogues, ${shape.cases} cases, ${plan.total} calls`;
    }),
    expectPass('preparation_guard_passed', 'the prepared-run identity guard passes at 72 dialogues', () => {
      if (guarded.preparation.status !== 'passed') throw new Error(guarded.preparation.status);
      const carried = guarded.preparation.artifacts_from_checkpoint_record || [];
      const stood_in = carried.length
        ? `; ${carried.length} burned corpora stood in from the launch record, candidates identical`
        : '';
      return `${guarded.preparation.prepared_run_count} prepared runs, no duplicate and no overlap${stood_in}`;
    }),
    expectPass('counter_arithmetic_closes', 'the ledger fields add up under the campaign ceiling', () => {
      if (plan.counter_after_if_completed !== plan.counter_before + plan.total)
        throw new Error('after != before+total');
      if (plan.remaining_after_if_completed !== OUTCOME_CAMPAIGN_CALL_CEILING - plan.counter_after_if_completed) {
        throw new Error('remaining does not close');
      }
      return `${plan.counter_before} + ${plan.total} = ${plan.counter_after_if_completed}, ${plan.remaining_after_if_completed} left under ${OUTCOME_CAMPAIGN_CALL_CEILING}`;
    }),
    expectRefusal('pilot_go_note_refused', "the pilot's GO note cannot launch the main block", () =>
      validateOutcomePilotGoNote(path.resolve(ROOT, pilotGoNotePath), { shape }),
    ),
    expectRefusal('shape_flag_mismatch_refused', '--shape pilot cannot launch a main-block manifest', () =>
      assertOutcomeShapeFlag({ expectedShape: 'pilot', shape }),
    ),
    expectRefusal('pilot_checkpoint_resume_refused', 'a pilot checkpoint cannot be resumed into this run', () =>
      assertOutcomeCheckpointShape({ checkpoint: { run_shape: 'pilot' }, shape }),
    ),
  ];

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'guarded-main-block-sim-'));
  try {
    const budget = createOutcomePilotBudget({
      checkpointPath: path.join(scratch, 'checkpoint.json'),
      shape,
    });
    checks.push(
      expectPass('budget_opens_at_zero', 'the budget opens on the main-block plan with nothing spent', () => {
        const actual = budget.state.call_budget.actual;
        if (actual.total !== 0) throw new Error(`budget opened at ${actual.total} calls`);
        if (budget.state.call_budget.plan.total !== shape.planned_calls.total) throw new Error('plan mismatch');
        if (budget.state.run_shape !== shape.name) throw new Error(`checkpoint says ${budget.state.run_shape}`);
        return `plan ${budget.state.call_budget.plan.total}, actual 0`;
      }),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  let goNote;
  if (goNotePath) {
    goNote = expectPass('supplied_go_note_accepted', 'the supplied launch note matches this run size', () => {
      validateOutcomePilotGoNote(path.resolve(ROOT, goNotePath), { shape });
      return `${goNotePath} states GO, the ${plan.total}-call scope and seeds ${shape.seeds[0]}-${shape.seeds.at(-1)}`;
    });
  } else if (heldGoNotePath) {
    goNote = expectRefusal('held_go_note_refused', 'the held launch note cannot launch this block yet', () =>
      validateOutcomePilotGoNote(path.resolve(ROOT, heldGoNotePath), { shape }),
    );
  } else {
    goNote = {
      name: 'no_go_note_supplied',
      expectation: 'without a launch note the block cannot launch',
      held: true,
      detail: 'no --go-note given; the run stays unauthorized',
    };
  }
  checks.push(goNote);

  return {
    schema: LAUNCH_SIMULATION_SCHEMA,
    zero_model_calls: true,
    status: checks.every((check) => check.held) ? 'passed' : 'failed',
    manifest: {
      path: manifestPath,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(resolvedManifest)).digest('hex'),
    },
    run_shape: shape.name,
    size: {
      seeds: [...shape.seeds],
      dialogues: shape.dialogues,
      turns_per_dialogue: shape.turns_per_dialogue,
      cases: shape.cases,
      readers_per_channel: shape.readers_per_channel,
    },
    planned_calls: plan,
    launch_authorized: guarded.manifest.launch_authorized === true,
    simulated_as: resumeRunDir ? 'restart' : 'first launch',
    exclusion_source: guarded.preparation.exclusion_source,
    artifacts_from_checkpoint_record: guarded.preparation.artifacts_from_checkpoint_record || [],
    checks,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: 'string', default: GUARDED_MAIN_BLOCK_MANIFEST },
      'pilot-go-note': { type: 'string', default: GUARDED_PILOT_GO_NOTE },
      'go-note': { type: 'string' },
      'held-go-note': { type: 'string' },
      'resume-run-dir': { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(
      'Usage:\n  node scripts/simulate-guarded-main-block-launch.js [--manifest <path>]\n' +
        '    [--go-note <path> | --held-go-note <path>] [--out <path>]\n\n' +
        `Runs the launcher's guard chain against a sealed ${Object.keys(OUTCOME_RUN_SHAPES).join('/')} manifest and stops\n` +
        'before the first call. Makes no model call and needs no credentials.\n\n' +
        '  --go-note       a note that must be accepted; the check fails if the launcher refuses it\n' +
        '  --held-go-note  a note that must be refused, as a launch note written before its\n' +
        '                  approval is; the check fails if the launcher would accept it\n' +
        '  --resume-run-dir  the run directory of a stopped run, to simulate a restart: the\n' +
        '                  identity guard then reads that checkpoint for any burned corpus\n' +
        '                  that no longer exists on disk\n',
    );
    return;
  }
  const report = simulateGuardedMainBlockLaunch({
    manifestPath: values.manifest,
    pilotGoNotePath: values['pilot-go-note'],
    goNotePath: values['go-note'] || null,
    heldGoNotePath: values['held-go-note'] || null,
    resumeRunDir: values['resume-run-dir'] || null,
  });
  if (values.out) {
    const resolved = path.resolve(ROOT, values.out);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[main-block-sim] ${error.message}`);
    process.exitCode = 1;
  }
}
