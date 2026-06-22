/**
 * Episode replay (replay.js) + the fast-iteration CLIs
 * (run-derivation-episode.js, run-derivation-matrix.js).
 *
 * The replay contract: the engine persists every formally consequential role
 * output in transcript meta, so feeding a recording back through the same
 * code path reconstructs the identical formal channel — and a condition
 * change at turn t therefore isolates its causal effect to turns ≥ t.
 * comparePrefix verifies that claim post-hoc instead of trusting it.
 *
 * CLI smokes are hermetic: artifacts land in mkdtemp dirs, mock backend only.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  loadWorld,
  runDrama,
  makeReplayRoles,
  comparePrefix,
  makeMockDirector,
  makeMockTutor,
  makeMockLearner,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_PATH = path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml');

const world = loadWorld(WORLD_PATH);

const mocks = (learnerPolicy = {}) => ({
  director: makeMockDirector(world),
  tutor: makeMockTutor(world),
  learner: makeMockLearner(learnerPolicy),
});

// ---------------------------------------------------------------------------
// engine maxTurns (the episode window mechanism)
// ---------------------------------------------------------------------------

test('options.maxTurns stops the loop early without inventing a terminal event', async () => {
  const result = await runDrama({ world, roles: mocks(), options: { maxTurns: 4 } });
  assert.equal(result.turnsPlayed, 4);
  assert.equal(result.verdict, 'cap_reached');
  assert.equal(result.firstForcedTurn, null);
});

// ---------------------------------------------------------------------------
// replay fidelity
// ---------------------------------------------------------------------------

test('full replay reproduces the entire formal channel of the recording', async () => {
  const recorded = await runDrama({ world, roles: mocks() });
  // fromTurn = turnsPlayed + 1: every turn replays, live roles never speak
  const roles = makeReplayRoles({ recorded, fromTurn: recorded.turnsPlayed + 1, live: mocks() });
  const replayed = await runDrama({ world, roles });
  const prefix = comparePrefix(replayed, recorded, recorded.turnsPlayed + 1);
  assert.ok(prefix.ok, JSON.stringify(prefix.mismatches));
  assert.equal(prefix.prefixTurns, recorded.turnsPlayed);
  assert.equal(replayed.verdict, recorded.verdict);
  assert.deepEqual(replayed.trajectory, recorded.trajectory);
  assert.deepEqual(replayed.ledger, recorded.ledger);
});

test('a condition change at turn t leaves the prefix identical and only the suffix diverges', async () => {
  const recorded = await runDrama({ world, roles: mocks() });
  assert.equal(recorded.verdict, 'grounded_anagnorisis');
  // live learner stops adopting after t5 → p3@t8 never lands → no forcing
  const roles = makeReplayRoles({ recorded, fromTurn: 5, live: mocks({ stallAfter: 5 }) });
  const episode = await runDrama({ world, roles });
  const prefix = comparePrefix(episode, recorded, 5);
  assert.ok(prefix.ok, JSON.stringify(prefix.mismatches));
  assert.equal(prefix.prefixTurns, 4);
  assert.equal(episode.verdict, 'disengagement');
  assert.deepEqual(
    episode.trajectory.map((p) => p.D),
    [3, 2, 2, 2, 1, 1, 1, 1],
  );
});

test('decay injected with startTurn ≥ fromTurn never reaches the prefix', async () => {
  const recorded = await runDrama({ world, roles: mocks() });
  const roles = makeReplayRoles({ recorded, fromTurn: 5, live: mocks() });
  const episode = await runDrama({
    world,
    roles,
    options: { decay: { seed: 2, rate: 1, graceTurns: 0, maxConcurrent: 2, startTurn: 5 } },
  });
  const prefix = comparePrefix(episode, recorded, 5);
  assert.ok(prefix.ok, JSON.stringify(prefix.mismatches));
  assert.ok(episode.corruption.ledger.length > 0);
  assert.ok(episode.corruption.ledger.every((e) => e.turn >= 5));
  // the same drama that succeeded on record fails under live-region decay —
  // the matched-pair causal read the episode mechanism exists for
  assert.equal(episode.verdict, 'disengagement');
});

// ---------------------------------------------------------------------------
// replay validation + mismatch detection
// ---------------------------------------------------------------------------

test('makeReplayRoles rejects out-of-range fromTurn and surfaces replay holes', async () => {
  const recorded = await runDrama({ world, roles: mocks() });
  assert.throws(() => makeReplayRoles({ recorded, fromTurn: 0, live: mocks() }), /fromTurn/);
  assert.throws(() => makeReplayRoles({ recorded, fromTurn: recorded.turnsPlayed + 2, live: mocks() }), /fromTurn/);
  // a recording with a missing line cannot be replayed silently
  const holed = JSON.parse(JSON.stringify(recorded));
  const idx = holed.transcript.findIndex((l) => l.role === 'learner' && l.turn === 3);
  holed.transcript.splice(idx, 1);
  const roles = makeReplayRoles({ recorded: holed, fromTurn: 5, live: mocks() });
  await assert.rejects(runDrama({ world, roles }), /replay hole/);
});

test('comparePrefix flags a doctored recording instead of trusting the replay', async () => {
  const recorded = await runDrama({ world, roles: mocks() });
  const roles = makeReplayRoles({ recorded, fromTurn: recorded.turnsPlayed + 1, live: mocks() });
  const replayed = await runDrama({ world, roles });
  const doctored = JSON.parse(JSON.stringify(recorded));
  doctored.trajectory[1].D += 1;
  const prefix = comparePrefix(replayed, doctored, recorded.turnsPlayed + 1);
  assert.equal(prefix.ok, false);
  assert.ok(prefix.mismatches.some((m) => m.kind === 'trajectory.D' && m.turn === 2));
});

// ---------------------------------------------------------------------------
// CLI smokes (hermetic: mkdtemp out-dirs, mock backend, no DB, no network)
// ---------------------------------------------------------------------------

const CLI_TIMEOUT = 60_000;

test('loop → episode → matrix CLIs round-trip decay conditions hermetically', { timeout: CLI_TIMEOUT }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-fastiter-'));
  const run = (script, args) =>
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const decayJson = '{"seed":7,"rate":0.5,"graceTurns":0,"maxConcurrent":2}';

  // 1. loop run with decay → diagnosis carries the condition + the report
  const srcStdout = run('run-derivation-loop.js', [
    '--world',
    'config/drama-derivation/world-000-smoke.yaml',
    '--label',
    'src',
    '--out',
    path.join(tmp, 'loop'),
    '--critic',
    'off',
    '--decay',
    decayJson,
  ]);
  assert.equal(srcStdout.includes('critic  FAILED'), false);
  assert.equal(fs.existsSync(path.join(tmp, 'loop/src/commentary.md')), false);
  const srcResult = JSON.parse(fs.readFileSync(path.join(tmp, 'loop/src/result.json'), 'utf8'));
  assert.equal(srcResult.logicSnapshots.length, srcResult.turnsPlayed);
  const srcLive = JSON.parse(fs.readFileSync(path.join(tmp, 'loop/src/live.json'), 'utf8'));
  assert.equal(srcLive.schema, 'dramatic-derivation.live.v1');
  assert.equal(srcLive.status, 'complete');
  assert.equal(srcLive.turns.length, srcResult.turnsPlayed);
  assert.ok(srcLive.turns.every((turn) => Array.isArray(turn.lines) && turn.lines.length >= 2));
  assert.ok(srcLive.turns.every((turn) => turn.lines.every((line) => line.role !== 'director')));
  const srcDiag = JSON.parse(fs.readFileSync(path.join(tmp, 'loop/src/diagnosis.json'), 'utf8'));
  assert.equal(srcDiag.decay.rate, 0.5);
  assert.ok(srcDiag.corruption);
  assert.equal(srcDiag.corruption.decayEvents, srcDiag.corruption.timeline.length);
  assert.equal(srcDiag.logicProjection.schema, 'dramatic-derivation.logic-projection-report.v0');
  assert.equal(srcDiag.logicProjection.turns.length, srcResult.turnsPlayed);

  // 2. episode inheriting the decay condition → prefix integrity holds
  run('run-derivation-episode.js', [
    '--from',
    path.join(tmp, 'loop/src'),
    '--turn',
    '5',
    '--window',
    '4',
    '--label',
    'inherit',
    '--out',
    path.join(tmp, 'episodes'),
  ]);
  const inherit = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/inherit/episode.json'), 'utf8'));
  assert.equal(inherit.prefixIntegrity.ok, true);
  const inheritLive = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/inherit/live.json'), 'utf8'));
  assert.equal(inheritLive.schema, 'dramatic-derivation.live.v1');
  assert.equal(inheritLive.kind, 'episode');
  assert.equal(inheritLive.status, 'complete');
  assert.equal(inheritLive.fromTurn, 5);
  assert.ok(inheritLive.turns.every((turn) => turn.turn >= 5));
  const inheritDiag = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/inherit/diagnosis.json'), 'utf8'));
  assert.deepEqual(inheritDiag.decay, srcDiag.decay);

  // 3. episode overriding decay OFF → prefix diverges, labeled as expected
  run('run-derivation-episode.js', [
    '--from',
    path.join(tmp, 'loop/src'),
    '--turn',
    '5',
    '--window',
    '4',
    '--decay',
    'off',
    '--label',
    'decay-off',
    '--out',
    path.join(tmp, 'episodes'),
  ]);
  const off = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/decay-off/episode.json'), 'utf8'));
  assert.equal(off.prefixIntegrity.ok, false);
  assert.equal(off.prefixIntegrity.expectedDivergence, true);
  const offDiag = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/decay-off/diagnosis.json'), 'utf8'));
  assert.equal(offDiag.decay, null);
  assert.equal('corruption' in offDiag, false);

  // 4. matrix: control vs decay arm, summary carries both diagnoses
  const spec = [
    'base:',
    '  world: config/drama-derivation/world-000-smoke.yaml',
    '  script: config/drama-derivation/tutor-scripts/nocturne-v001.md',
    'arms:',
    '  - label: control',
    '  - label: decayed',
    '    flags:',
    `      decay: '${decayJson}'`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(tmp, 'spec.yaml'), spec);
  run('run-derivation-matrix.js', [
    '--spec',
    path.join(tmp, 'spec.yaml'),
    '--label',
    'mx',
    '--out',
    path.join(tmp, 'matrix'),
  ]);
  const summary = JSON.parse(fs.readFileSync(path.join(tmp, 'matrix/mx/matrix-summary.json'), 'utf8'));
  assert.equal(summary.arms.length, 2);
  const byLabel = Object.fromEntries(summary.arms.map((a) => [a.label, a]));
  assert.ok(byLabel.control.diagnosis);
  assert.equal('corruption' in byLabel.control.diagnosis, false);
  assert.ok(byLabel.decayed.diagnosis.corruption.decayEvents >= 1);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('episode CLI inherits modern guard and plot dials while preserving replay prefix', { timeout: CLI_TIMEOUT }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-modern-episode-'));
  const run = (script, args) =>
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  run('run-derivation-loop.js', [
    '--world',
    'config/drama-derivation/world-000-smoke.yaml',
    '--label',
    'src',
    '--out',
    path.join(tmp, 'loop'),
    '--critic',
    'off',
    '--superego',
    '--acts',
    '{"minActTurns":1,"maxActTurns":3}',
    '--decay',
    '{"seed":7,"rate":0.5,"graceTurns":0,"maxConcurrent":2,"startTurn":1,"mutateShare":0}',
    '--confront',
    '--repair-clause',
    '--release-authority',
    '--pacing-guard-selective-v3',
    '--conduct-policy',
    '--conduct-policy-enforce',
    '--plot',
    '--throughline',
  ]);
  run('run-derivation-episode.js', [
    '--from',
    path.join(tmp, 'loop/src'),
    '--turn',
    '3',
    '--window',
    '2',
    '--label',
    'ep',
    '--out',
    path.join(tmp, 'episodes'),
  ]);

  const d = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/ep/diagnosis.json'), 'utf8'));
  assert.equal(d.episode.prefixIntegrity.ok, true);
  assert.equal(d.confront, true);
  assert.equal(d.repairClause, true);
  assert.equal(d.releaseAuthority, true);
  assert.equal(d.pacingGuardSelectiveV3, true);
  assert.equal(d.visiblePushProbeGuard, true);
  assert.equal(d.pacingGuardSelector.schema, 'dramatic-derivation.representation-selector.v3');
  assert.equal(d.conductPolicy, true);
  assert.equal(d.conductPolicyEnforce, true);
  assert.ok(d.conductPolicyReport?.loggedTurns >= 1);
  assert.ok(d.conductPolicyReport?.enforcement?.enabledTurns >= 1);
  assert.equal(d.plotDial, true);
  assert.equal(d.throughlineDial, true);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('episode CLI inherits discursive and didactic advisory tutor metadata', { timeout: CLI_TIMEOUT }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-discursive-episode-'));
  const run = (script, args) =>
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  run('run-derivation-loop.js', [
    '--world',
    'config/drama-derivation/world-000-smoke.yaml',
    '--label',
    'src',
    '--out',
    path.join(tmp, 'loop'),
    '--critic',
    'off',
    '--scene-mode',
    'on',
    '--rhetorical-policy',
    '--discursive-calibration',
    '--didactic-mode',
  ]);
  run('run-derivation-episode.js', [
    '--from',
    path.join(tmp, 'loop/src'),
    '--turn',
    '3',
    '--window',
    '2',
    '--label',
    'ep',
    '--out',
    path.join(tmp, 'episodes'),
  ]);

  const d = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/ep/diagnosis.json'), 'utf8'));
  assert.equal(d.episode.prefixIntegrity.ok, true);
  assert.equal(d.discursiveCalibration, true);
  assert.equal(d.didacticMode, true);
  assert.equal(d.rhetoricalPolicy.mode, 'deterministic');
  assert.ok(d.didacticModeReport?.turns >= 1);
  assert.equal(d.didacticModeReport.auditClean, true);
  const result = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/ep/result.json'), 'utf8'));
  const liveTutorLine = result.transcript.find((line) => line.turn >= 3 && line.role === 'tutor');
  assert.equal(
    liveTutorLine?.meta?.discursiveCalibration?.schema,
    'dramatic-derivation.discursive-calibration.v0',
  );
  assert.equal(liveTutorLine.meta.discursiveCalibration.nonLeakAudit.ok, true);
  assert.equal(liveTutorLine?.meta?.didacticMode?.schema, 'dramatic-derivation.didactic-mode.v0');
  assert.equal(liveTutorLine.meta.didacticMode.inputAudit.ok, true);
  assert.equal(liveTutorLine.meta.didacticMode.mayOverrideProofControl, false);
  assert.equal(liveTutorLine.meta.rhetoricalPolicy.schema, 'dramatic-derivation.rhetorical-policy.v0');
  assert.equal(
    liveTutorLine.meta.rhetoricalPolicy.discursiveCalibration.publicPosture,
    liveTutorLine.meta.discursiveCalibration.publicPosture,
  );
  if (liveTutorLine.meta.rhetoricalPolicy.didacticMode) {
    assert.equal(
      liveTutorLine.meta.rhetoricalPolicy.didacticMode.recommendedMode,
      liveTutorLine.meta.didacticMode.recommendedMode,
    );
  }
  const live = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/ep/live.json'), 'utf8'));
  assert.ok(live.turns.some((turn) => turn.didacticMode?.recommendedMode));

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('episode CLI inherits selector v4 consolidation and answer-gate without default conduct enforcement', { timeout: CLI_TIMEOUT }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-v4-episode-'));
  const run = (script, args) =>
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  run('run-derivation-loop.js', [
    '--world',
    'config/drama-derivation/world-000-smoke.yaml',
    '--label',
    'src',
    '--out',
    path.join(tmp, 'loop'),
    '--critic',
    'off',
    '--superego',
    '--acts',
    '{"minActTurns":1,"maxActTurns":3}',
    '--decay',
    '{"seed":7,"rate":0.5,"graceTurns":0,"maxConcurrent":2,"startTurn":1,"mutateShare":0}',
    '--confront',
    '--repair-clause',
    '--release-authority',
    '--pacing-guard-selective-v4',
    '--same-turn-assertion-affordance',
    '--plot',
    '--throughline',
  ]);
  run('run-derivation-episode.js', [
    '--from',
    path.join(tmp, 'loop/src'),
    '--turn',
    '3',
    '--window',
    '2',
    '--label',
    'ep',
    '--out',
    path.join(tmp, 'episodes'),
  ]);

  const d = JSON.parse(fs.readFileSync(path.join(tmp, 'episodes/ep/diagnosis.json'), 'utf8'));
  assert.equal(d.episode.prefixIntegrity.ok, true);
  assert.equal(d.pacingGuardSelectiveV4, true);
  assert.equal(d.visibleConsolidationGuard, true);
  assert.equal(d.assertionGroundingGate, true);
  assert.equal(d.sameTurnAssertionAffordance, true);
  assert.equal(d.pacingGuardSelector.schema, 'dramatic-derivation.representation-selector.v4');
  assert.equal(d.conductPolicy, false);
  assert.equal(d.conductPolicyEnforce, false);
  assert.equal(d.conductPolicyReport, undefined);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('fresh loop does not default conduct enforcement for selector v4 or hidden plus proofDebt', { timeout: CLI_TIMEOUT }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-v4-conduct-default-'));
  const run = (args) =>
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/run-derivation-loop.js'), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  run([
    '--world',
    'config/drama-derivation/world-000-smoke.yaml',
    '--label',
    'v4',
    '--out',
    path.join(tmp, 'loop'),
    '--critic',
    'off',
    '--release-authority',
    '--pacing-guard-selective-v4',
  ]);
  const v4 = JSON.parse(fs.readFileSync(path.join(tmp, 'loop/v4/diagnosis.json'), 'utf8'));
  assert.equal(v4.pacingGuardSelectiveV4, true);
  assert.equal(v4.visibleConsolidationGuard, true);
  assert.equal(v4.conductPolicy, false);
  assert.equal(v4.conductPolicyEnforce, false);
  assert.equal(v4.conductPolicyReport, undefined);

  run([
    '--world',
    'config/drama-derivation/world-000-smoke.yaml',
    '--label',
    'hidden-proofdebt',
    '--out',
    path.join(tmp, 'loop'),
    '--critic',
    'off',
    '--superego',
    '--acts',
    '{"minActTurns":1,"maxActTurns":3}',
    '--decay',
    '{"seed":7,"rate":0.5,"graceTurns":0,"maxConcurrent":2,"startTurn":1,"mutateShare":0}',
    '--confront',
    '--repair-clause',
    '--release-authority',
    '--pacing-guard',
    '--proof-debt-guard',
  ]);
  const hidden = JSON.parse(fs.readFileSync(path.join(tmp, 'loop/hidden-proofdebt/diagnosis.json'), 'utf8'));
  assert.equal(hidden.pacingGuard, true);
  assert.equal(hidden.proofDebtGuard, true);
  assert.equal(hidden.conductPolicy, false);
  assert.equal(hidden.conductPolicyEnforce, false);
  assert.equal(hidden.conductPolicyReport, undefined);

  run([
    '--world',
    'config/drama-derivation/world-000-smoke.yaml',
    '--label',
    'progress-policy',
    '--out',
    path.join(tmp, 'loop'),
    '--critic',
    'off',
    '--conduct-progress-policy',
  ]);
  const progress = JSON.parse(fs.readFileSync(path.join(tmp, 'loop/progress-policy/diagnosis.json'), 'utf8'));
  assert.equal(progress.conductProgressPolicy, true);
  assert.equal(progress.conductPolicy, true);
  assert.equal(progress.conductPolicyEnforce, false);
  assert.ok(progress.conductPolicyReport?.loggedTurns >= 1);

  fs.rmSync(tmp, { recursive: true, force: true });
});
