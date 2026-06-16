import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyzeA21Trials, runA21Microbench } from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  return readFileSync(file, 'utf8')
    .split(/\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('A21 trial runner evaluates all four actions from one fixture with balanced propensities', () => {
  const fixture = readJson(path.join(ROOT, 'exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json'));
  const actionSet = readJson(path.join(ROOT, 'exports/dramatic-derivation/a21-action-value/action-set.json'));
  const run = runA21Microbench({ fixture, actionSet, mode: 'deterministic', k: 1, seed: 20260616 });

  assert.equal(run.trials.length, 4);
  assert.equal(run.assignmentProbability, 0.25);
  assert.deepEqual(
    run.trials.map((trial) => trial.action.actionId).sort(),
    ['A_DIAG_CONFLICT', 'B_RELEASE_P_POINT', 'C_RESTAGE_P_POINT', 'D_CONSOLIDATE_THEN_RELEASE'],
  );
  for (const trial of run.trials) {
    assert.equal(trial.assignmentProbability, 0.25);
    assert.equal(trial.fixtureHash, fixture.fixtureHash);
    assert.equal(trial.transitionOutcome.learnerStateBefore.proofProgress.D, 5);
    assert.equal(trial.actionExecution.actionLog.assignmentProbability, 0.25);
  }
  const analysis = analyzeA21Trials({ trials: run.trials, fixture });
  assert.equal(analysis.decisionCategory, 'release_beats_diagnostic');
  assert.deepEqual(analysis.topActionIds, ['B_RELEASE_P_POINT']);
});

test('A21 microbench and analysis CLIs write deterministic local artifacts', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'a21-microbench-'));
  const trialsPath = path.join(dir, 'trials.jsonl');
  const reportPath = path.join(dir, 'report.md');
  const jsonPath = path.join(dir, 'report.json');

  execFileSync(
    process.execPath,
    [
      'scripts/a21-run-microbench.js',
      '--fixture',
      'exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json',
      '--actions',
      'exports/dramatic-derivation/a21-action-value/action-set.json',
      '--out',
      trialsPath,
    ],
    { cwd: ROOT, stdio: 'pipe' },
  );
  const trials = readJsonl(trialsPath);
  assert.equal(trials.length, 4);

  execFileSync(
    process.execPath,
    ['scripts/a21-analyze-microbench.js', '--trials', trialsPath, '--out', reportPath, '--json-out', jsonPath],
    { cwd: ROOT, stdio: 'pipe' },
  );
  const analysis = readJson(jsonPath);
  const report = readFileSync(reportPath, 'utf8');
  assert.equal(analysis.decisionCategory, 'release_beats_diagnostic');
  assert.match(report, /Runtime policy changes: none/u);
});
