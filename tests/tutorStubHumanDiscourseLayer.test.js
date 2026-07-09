import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
  assert.equal(config.humanDiscourse.phase, 'phase_1_trace_shapes');
  assert.equal(config.humanDiscourse.behaviorChange, false);
  assert.deepEqual(config.humanDiscourse.traceFields, [
    'humanDiscourseFrame',
    'scaffoldState',
    'sideArc',
    'proofDebt',
    'warrantPremiseAudit',
  ]);
});

test('tutor-stub DAG mode defaults to strict audit mode', () => {
  const config = tutorStubDryRun();

  assert.equal(config.humanDiscourse.dagMode, 'strict_dag');
  assert.equal(config.humanDiscourse.behaviorChange, false);
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
