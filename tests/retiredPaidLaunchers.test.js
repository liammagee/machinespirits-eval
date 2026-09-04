import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  RETIRED_PAID_LAUNCHERS,
  RetiredPaidLauncherError,
  refuseRetiredPaidLaunch,
} from '../services/retiredPaidLauncher.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RETIRED_ENTRYPOINTS = [
  ['adaptive-warrant-outcome-main-block', 'run-adaptive-warrant-outcome-main-block.js', ['--accept-charges']],
  ['adaptive-warrant-outcome-pilot', 'run-adaptive-warrant-outcome-pilot.js', ['--accept-charges']],
  ['adaptive-warrant-steering-decomposition', 'run-adaptive-warrant-steering-decomposition.js', ['--accept-charges']],
  ['tutor-stub-defiant-warrant-pilot', 'run-tutor-stub-defiant-warrant-pilot.js', ['--live', '--accept-charges']],
  ['tutor-stub-frame-refuser-depth-calibration', 'run-tutor-stub-frame-refuser-depth-calibration.js', ['--launch']],
  [
    'tutor-stub-resistance-action-register-manipulation-validation',
    'run-tutor-stub-resistance-action-register-manipulation-validation.js',
    ['--accept-charges'],
  ],
  [
    'tutor-stub-resistance-warm-nonwarm-confirmation',
    'run-tutor-stub-resistance-warm-nonwarm-confirmation.js',
    ['--live', '--accept-charges'],
  ],
  ['tutor-stub-resistant-learner-calibration-v2', 'run-tutor-stub-resistant-learner-calibration-v2.js', []],
  ['tutor-stub-resistant-learner-calibration', 'run-tutor-stub-resistant-learner-calibration.js', ['--accept-charges']],
  [
    'tutor-stub-resistant-learner-merged-calibration',
    'run-tutor-stub-resistant-learner-merged-calibration.js',
    ['--launch'],
  ],
  [
    'tutor-stub-action-outcome-model-judge-shadow',
    'run-tutor-stub-action-outcome-model-judge-shadow.js',
    ['--accept-charges'],
  ],
  [
    'tutor-stub-frame-refuser-narrowing-calibration',
    'run-tutor-stub-frame-refuser-narrowing-calibration.js',
    ['--accept-charges'],
  ],
  [
    'tutor-stub-frame-refuser-satisfiable-calibration',
    'run-tutor-stub-frame-refuser-satisfiable-calibration.js',
    ['--accept-charges'],
  ],
];

const EXPORTED_EXECUTORS = [
  [
    'adaptive-warrant-outcome-main-block',
    '../scripts/run-adaptive-warrant-outcome-main-block.js',
    'executeOutcomeMainBlock',
    (destination, callback) => ({
      acceptCharges: true,
      outputDir: destination,
      runDialogue: callback,
      runReaderProcess: callback,
    }),
  ],
  [
    'adaptive-warrant-outcome-main-block',
    '../scripts/run-adaptive-warrant-outcome-main-block.js',
    'runAfterOutcomeMainBlockAllowanceGuard',
    (_destination, callback) => ({ callsAttempted: 0, launch: callback }),
  ],
  [
    'adaptive-warrant-outcome-pilot',
    '../scripts/run-adaptive-warrant-outcome-pilot.js',
    'executeOutcomePilot',
    (destination, callback) => ({
      acceptCharges: true,
      outputDir: destination,
      runDialogue: callback,
      runReaderProcess: callback,
    }),
  ],
  [
    'adaptive-warrant-outcome-pilot',
    '../scripts/run-adaptive-warrant-outcome-pilot.js',
    'runReadersAfterFingerprintGuard',
    (_destination, callback) => ({ cases: [], keyCases: [], expectedCount: 0, runReaders: callback }),
  ],
  [
    'adaptive-warrant-outcome-pilot',
    '../scripts/run-adaptive-warrant-outcome-pilot.js',
    'runOutcomeGeneration',
    (_destination, callback) => ({ jobs: [], runDialogue: callback }),
  ],
  [
    'adaptive-warrant-outcome-pilot',
    '../scripts/run-adaptive-warrant-outcome-pilot.js',
    'runReaderProcesses',
    (_destination, callback) => ({ runProcess: callback }),
  ],
  [
    'adaptive-warrant-steering-decomposition',
    '../scripts/run-adaptive-warrant-steering-decomposition.js',
    'executeSteeringDecomposition',
    (destination, callback) => ({
      acceptCharges: true,
      outputDir: destination,
      runDialogue: callback,
      runReaderProcess: callback,
    }),
  ],
  [
    'adaptive-warrant-steering-decomposition',
    '../scripts/run-adaptive-warrant-steering-decomposition.js',
    'runAfterSteeringDecompositionAllowanceGuard',
    (_destination, callback) => ({ callsAttempted: 0, launch: callback }),
  ],
  [
    'tutor-stub-defiant-warrant-pilot',
    '../scripts/run-tutor-stub-defiant-warrant-pilot.js',
    'runDefiantWarrantPilot',
    (destination) => ({ destination }),
  ],
  [
    'tutor-stub-frame-refuser-depth-calibration',
    '../scripts/run-tutor-stub-frame-refuser-depth-calibration.js',
    'executeTutorStubFrameRefuserDepthCalibration',
    (destination, callback) => ({ destination, runChild: callback }),
  ],
  [
    'tutor-stub-resistance-warm-nonwarm-confirmation',
    '../scripts/run-tutor-stub-resistance-warm-nonwarm-confirmation.js',
    'runTutorStubResistanceWarmNonwarmConfirmation',
    (destination) => ({ destination }),
  ],
  [
    'tutor-stub-resistant-learner-merged-calibration',
    '../scripts/run-tutor-stub-resistant-learner-merged-calibration.js',
    'executeTutorStubResistantLearnerMergedCalibration',
    (destination, callback) => ({ destination, runChild: callback }),
  ],
  [
    'tutor-stub-resistant-learner-calibration',
    '../scripts/run-tutor-stub-resistant-learner-calibration.js',
    'runTutorStubResistantLearnerCalibrationChild',
    (destination) => ({ stdout: destination, stderr: `${destination}.stderr`, args: [], env: {} }),
  ],
  [
    'tutor-stub-action-outcome-model-judge-shadow',
    '../scripts/run-tutor-stub-action-outcome-model-judge-shadow.js',
    'executeTutorStubActionOutcomeModelJudge',
    (destination, callback) => ({ preflight: { destination }, callBridge: callback }),
  ],
  [
    'tutor-stub-frame-refuser-narrowing-calibration',
    '../scripts/run-tutor-stub-frame-refuser-narrowing-calibration.js',
    'executeTutorStubFrameRefuserNarrowingCalibration',
    (destination, callback) => ({ preflight: { destination }, callBridge: callback }),
  ],
  [
    'tutor-stub-frame-refuser-satisfiable-calibration',
    '../scripts/run-tutor-stub-frame-refuser-satisfiable-calibration.js',
    'executeTutorStubFrameRefuserSatisfiableCalibration',
    (destination, callback) => ({ destination, runChild: callback }),
  ],
];

test('retirement registry exactly covers the thirteen disposed paid launchers', () => {
  assert.deepEqual(Object.keys(RETIRED_PAID_LAUNCHERS).sort(), RETIRED_ENTRYPOINTS.map(([id]) => id).sort());
});

test('the shared retirement boundary returns a stable fail-closed error', () => {
  assert.throws(
    () => refuseRetiredPaidLaunch('tutor-stub-action-outcome-model-judge-shadow'),
    (error) =>
      error instanceof RetiredPaidLauncherError &&
      error.code === 'PAID_LAUNCHER_RETIRED' &&
      error.launcherId === 'tutor-stub-action-outcome-model-judge-shadow' &&
      /new paid\/provider dispatch is disabled/u.test(error.message),
  );
  assert.throws(() => refuseRetiredPaidLaunch('misspelled-launcher'), /is not registered/u);
});

for (const [launcherId, scriptName, paidArgs] of RETIRED_ENTRYPOINTS) {
  test(`${launcherId} refuses its former paid CLI path before preflight or dispatch`, () => {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', scriptName), ...paidArgs], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, OPENROUTER_API_KEY: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' },
      timeout: 15_000,
    });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    assert.match(output, new RegExp(`paid launcher retired: ${launcherId}`, 'u'));
    assert.match(output, /new paid\/provider dispatch is disabled/u);
  });
}

for (const [launcherId, modulePath, exportName, buildArguments] of EXPORTED_EXECUTORS) {
  test(`${launcherId} ${exportName} refuses before callbacks or filesystem activity`, async (t) => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retired-paid-launcher-'));
    t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
    const destination = path.join(temporaryRoot, 'must-not-exist');
    let callbacks = 0;
    const callback = async () => {
      callbacks += 1;
      throw new Error('retirement guard failed before callback');
    };
    const loaded = await import(modulePath);
    await assert.rejects(
      Promise.resolve().then(() => loaded[exportName](buildArguments(destination, callback))),
      (error) => error?.code === 'PAID_LAUNCHER_RETIRED' && error.launcherId === launcherId,
    );
    assert.equal(callbacks, 0);
    assert.equal(fs.existsSync(destination), false);
  });
}
