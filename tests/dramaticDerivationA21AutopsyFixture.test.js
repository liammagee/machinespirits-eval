import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function keysOf(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
}

test('A21 autopsy and trigger-fixture CLIs produce the Hethel t4 action-value fixture', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'a21-fixture-'));
  const autopsyMd = path.join(dir, 'autopsy.md');
  const autopsyJson = path.join(dir, 'autopsy.json');
  const fixtureJson = path.join(dir, 'fixture.json');
  const actionSetJson = path.join(dir, 'action-set.json');
  const fixtureMd = path.join(dir, 'fixture.md');

  execFileSync(
    process.execPath,
    ['scripts/a21-hethel-autopsy.js', '--out', autopsyMd, '--json-out', autopsyJson],
    { cwd: ROOT, stdio: 'pipe' },
  );
  const autopsy = readJson(autopsyJson);
  assert.equal(autopsy.schema, 'dramatic-derivation.a21.hethel-autopsy.v0');
  assert.equal(autopsy.primaryDivergence.triggerTurn, 4);
  assert.equal(autopsy.primaryDivergence.prefixThroughTurn, 3);
  assert.equal(autopsy.primaryDivergence.primaryLabel, 'release_starvation');
  assert.equal(autopsy.primaryDivergence.hiddenAction.released, 'p_point');
  assert.equal(autopsy.primaryDivergence.failedAction.released, null);

  execFileSync(
    process.execPath,
    [
      'scripts/a21-build-trigger-fixture.js',
      '--autopsy',
      autopsyJson,
      '--out',
      fixtureJson,
      '--actions-out',
      actionSetJson,
      '--report-out',
      fixtureMd,
    ],
    { cwd: ROOT, stdio: 'pipe' },
  );
  const fixture = readJson(fixtureJson);
  const actionSet = readJson(actionSetJson);
  assert.equal(fixture.schema, 'dramatic-derivation.a21.trigger-fixture.v0');
  assert.equal(fixture.trigger.turn, 4);
  assert.equal(fixture.trigger.prefixThroughTurn, 3);
  assert.equal(fixture.publicLearnerState.evidenceSeen.p_point, false);
  assert.equal(fixture.publicLearnerState.diagnosticHistory.count, 2);
  assert.equal(actionSet.actions.length, 4);
  assert.equal(actionSet.winnerActionId, null);
  assert.deepEqual(
    keysOf(fixture.publicTranscriptPrefix).filter((key) =>
      ['proofPath', 'rawBoard', 'corruptionLedger', 'secret'].includes(key),
    ),
    [],
  );
});
