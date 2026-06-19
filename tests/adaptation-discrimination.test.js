import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('deterministic adaptation policy evaluation separates closed loop from legacy', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const suite = JSON.parse(
    fs.readFileSync(path.join(root, 'config/adaptation-discrimination-scenarios.json'), 'utf8'),
  );
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptation-policy-eval-'));
  const out = path.join(tmp, 'report.json');
  execFileSync(process.execPath, ['scripts/evaluate-adaptation-policy.js', '--output', out], {
    cwd: root,
    stdio: 'pipe',
  });
  const report = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(report.scenarioCount, suite.scenarios.length);
  assert.ok(report.aggregates.closed_loop.strictJointSuccess > report.aggregates.legacy.strictJointSuccess);
  assert.ok(report.aggregates.closed_loop.stateTop1Accuracy > report.aggregates.legacy.stateTop1Accuracy);
  assert.ok(report.aggregates.closed_loop.counterfactualRegret < report.aggregates.legacy.counterfactualRegret);
});
