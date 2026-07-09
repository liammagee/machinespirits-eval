import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tutorStubDryRun(extraArgs = []) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--dry-run',
        '--no-trace',
        '--world',
        'world_005_marrick',
        '--dag',
        '--tutor-learner-dag',
        ...extraArgs,
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
}

test('tutor-stub dry run exposes human discourse trace schemas', () => {
  const config = tutorStubDryRun(['--dag-mode', 'defeasible-human-scaffold']);

  assert.equal(config.humanDiscourse.schema, 'machinespirits.tutor-stub.human-discourse-run-config.v1');
  assert.equal(config.humanDiscourse.dagMode, 'defeasible_human_scaffold');
  assert.equal(config.humanDiscourse.strictAuditDag, true);
  assert.equal(config.humanDiscourse.tutorLearnerDag, true);
  assert.equal(config.humanDiscourse.phase, 'phase_2_human_scaffold_prompting');
  assert.equal(config.humanDiscourse.scaffoldActive, true);
  assert.equal(config.humanDiscourse.behaviorChange, true);
  assert.deepEqual(config.humanDiscourse.traceFields, [
    'humanDiscourseFrame',
    'scaffoldState',
    'sideArc',
    'proofDebt',
    'warrantPremiseAudit',
  ]);
  assert.equal(config.humanDiscoursePreviewFrame.mode, 'defeasible_human_scaffold');
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldActive, true);
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldState.status, 'projected_from_dramaturgy');
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldState.activeAct.title, 'The Light Shillings');
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldState.branch.id, 'mirror_pressure');
  assert.match(config.humanDiscoursePreviewFrame.scaffoldState.localQuestion, /town case/u);
});

test('tutor-stub DAG mode defaults to strict audit mode', () => {
  const config = tutorStubDryRun();

  assert.equal(config.humanDiscourse.dagMode, 'strict_dag');
  assert.equal(config.humanDiscourse.scaffoldActive, false);
  assert.equal(config.humanDiscourse.behaviorChange, false);
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldActive, false);
  assert.equal(config.humanDiscoursePreviewFrame.scaffoldState.status, 'not_enabled_strict_dag');
});

test('tutor-stub rejects unknown DAG discourse modes', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--dry-run',
      '--no-trace',
      '--world',
      'world_005_marrick',
      '--dag-mode',
      'guesswork',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown --dag-mode: guesswork/);
});

test('auto-eval dry run forwards DAG discourse mode to tutor-stub children', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-human-scaffold-auto-'));
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-tutor-stub-auto-eval.js',
        '--runs',
        '1',
        '--policies',
        'continuous_dynamical_system',
        '--turns',
        '1',
        '--trace-dir',
        tmp,
        '--dag-mode',
        'human-scaffold',
        '--dry-run',
        '--no-html-report',
        '--no-ledger',
        '--no-progress',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const summaryPath = fs
      .readdirSync(tmp)
      .filter((name) => /^auto-eval-.*\.json$/u.test(name))
      .map((name) => path.join(tmp, name))
      .at(0);
    assert.ok(summaryPath);
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.equal(summary.config.dagMode, 'human-scaffold');
    const command = summary.results[0].command;
    const modeIndex = command.indexOf('--dag-mode');
    assert.ok(modeIndex > 0);
    assert.equal(command[modeIndex + 1], 'human-scaffold');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
