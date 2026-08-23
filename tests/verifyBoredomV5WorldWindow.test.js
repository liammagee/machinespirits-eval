import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-boredom-v5-world-window.js');
const V4 = path.join(ROOT, 'config', 'tutor-stub-boredom-action-register-proof-dag-registration.v4.json');
const V5 = path.join(ROOT, 'config', 'tutor-stub-boredom-action-register-proof-dag-registration.v5.json');

function run(registration) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, '--registration', registration, '--json'], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    return { code: 0, result: JSON.parse(stdout) };
  } catch (error) {
    return { code: error.status, result: JSON.parse(String(error.stdout || '{}')) };
  }
}

test('every world the v5 registration names can move the endpoints inside its own turn budget', () => {
  const { code, result } = run(V5);
  assert.equal(code, 0);
  assert.equal(result.pass, true);
  assert.equal(result.worlds.length, 6);
  for (const world of result.worlds) {
    assert.equal(world.ok, true, `${world.world}: ${world.why || ''}`);
    assert.ok(
      world.usableAtEarliestEndTurn >= result.requiredUsablePathPremises,
      `${world.world} must clear the rule in the worst case, not the best`,
    );
  }
});

test('the same check fails the v4 registration, which is the defect v5 exists to fix', () => {
  const { code, result } = run(V4);
  assert.equal(code, 1, 'a design whose worlds cannot move its endpoints must not pass');
  assert.equal(result.pass, false);
  assert.equal(result.earliestEndTurn, 3);
  assert.equal(
    result.worlds.filter((world) => world.ok).length,
    0,
    'no v4 world released a path premise before its dialogue could end',
  );
});

test('a longer window alone does not rescue a world that opens too late', () => {
  // world 033 opens its shortest path at turn 9. Give the v5 budget its worlds
  // plus that one and the check must single it out, so the rule is measuring
  // the world and not just the turn count.
  const registration = JSON.parse(fs.readFileSync(V5, 'utf8'));
  registration.design.worlds = ['world_030_rowan_flat', 'world_033_alder_row_redoubt'];
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v5-window-')), 'registration.json');
  fs.writeFileSync(file, JSON.stringify(registration));

  const { code, result } = run(file);
  assert.equal(code, 1);
  assert.equal(result.worlds.find((world) => world.world === 'world_030_rowan_flat').ok, true);
  const late = result.worlds.find((world) => world.world === 'world_033_alder_row_redoubt');
  assert.equal(late.ok, false);
  assert.equal(late.usableAtEarliestEndTurn, 0);
  assert.match(late.why, /the rule needs 2/u);
});
