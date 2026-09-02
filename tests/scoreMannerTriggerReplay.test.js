import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

// Offline replay contract for scripts/score-manner-trigger.js (card:
// workplan/items/state-detection-without-word-lists.md, step 1). The fixture
// trace has one tier-1 hit, one bag-only hit at a quiet (lost) plant and one
// silent plant, so the tier split is visible in the numbers.

const ROOT = path.resolve('.');
const SCRIPT = path.join(ROOT, 'scripts', 'score-manner-trigger.js');
const TRIGGER = 'tests/fixtures/manner-trigger/mini-cascade.json';
const TRACE = 'tests/fixtures/manner-trigger/replay-mini.jsonl';

function run(args) {
  return execFileSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
}

function runJson(args) {
  return JSON.parse(run([...args, '--json']));
}

function byTurn(report) {
  return Object.fromEntries(report.perPlant.map((row) => [row.turn, row]));
}

test('full cascade: the bag fires at the lost plant and counts as a wrong-fire', () => {
  const report = runJson(['--trigger', TRIGGER, '--trace', TRACE, '--per-plant', '--no-defaults']);
  assert.equal(report.schema, 'machinespirits.tutor-stub.manner-trigger-scorecard.v2');
  assert.equal(report.triggerVersion, 'mini');
  assert.equal(report.tiers, 'all');
  assert.equal(report.defaultBenchMissing, false);
  assert.equal(report.bench.shouldFirePlants, 2);
  assert.equal(report.bench.classificationRecall, '1/2');
  assert.equal(report.bench.kindRecall, '1/2');
  assert.equal(report.bench.quietPlants, 1);
  assert.equal(report.bench.wrongFiresAtQuietPlants, 1);
  assert.deepEqual(Object.keys(report.sets), ['manner-trigger']);

  const plants = byTurn(report);
  assert.equal(plants[1].verdict, 'right');
  assert.equal(plants[1].pressure, 'mockery');
  assert.equal(plants[1].livePressure, 'mockery');
  assert.equal(plants[1].liveVersion, 'mini');
  assert.equal(plants[2].verdict, 'wrong-fire');
  assert.equal(plants[2].pressure, 'demand');
  assert.equal(plants[2].quiet, null, 'the quiet detector stands aside when the trigger classified the turn');
  assert.equal(plants[3].verdict, 'silent');
  assert.equal(report.bench.misses.length, 1);
  assert.equal(report.bench.misses[0].turn, 3);
});

test('--tiers patterns strips the bag: the lost plant goes quiet and qd-v2 reads it', () => {
  const report = runJson([
    '--trigger',
    TRIGGER,
    '--trace',
    TRACE,
    '--tiers',
    'patterns',
    '--per-plant',
    '--no-defaults',
  ]);
  assert.equal(report.triggerVersion, 'mini:patterns');
  assert.equal(report.tiers, 'patterns');
  assert.equal(report.bench.classificationRecall, '1/2');
  assert.equal(report.bench.wrongFiresAtQuietPlants, 0);
  const plants = byTurn(report);
  assert.equal(plants[1].verdict, 'right');
  assert.equal(plants[2].verdict, 'quiet-ok');
  assert.equal(plants[2].quiet, 'confused');
});

test('text report names the tier split and the quiet-plant counts', () => {
  const text = run(['--trigger', TRIGGER, '--trace', TRACE, '--tiers', 'patterns+bags', '--no-defaults']);
  assert.match(text, /^trigger mini:patterns\+bags \(tiers: patterns\+bags\)/m);
  assert.match(text, /wrong-fires at quiet plants 1\/1/);
});

test('rejects unknown flags and --tiers without a trigger', () => {
  assert.throws(() => run(['--bogus', '--no-defaults']), /unknown argument: "--bogus"/);
  assert.throws(() => run(['--tiers', 'patterns', '--no-defaults']), /--tiers needs --trigger/);
  assert.throws(() => run(['--trigger', TRIGGER, '--tiers', 'nope', '--no-defaults']), /--tiers must be/);
});
