import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseArgs, scoreDerivationRubricSuite } from '../scripts/score-derivation-transcript-rubric-suite.js';

function writeRun(root, label, { verdict = 'grounded_anagnorisis', finalD = 0 } = {}) {
  const dir = path.join(root, label);
  fs.mkdirSync(dir, { recursive: true });
  const live = {
    label,
    worldId: 'fixture_world',
    worldTitle: 'Fixture World',
    turnsPlayed: 2,
    firstForcedTurn: 2,
    assertedGroundedTurn: 2,
    verdict,
    turns: [
      {
        turn: 1,
        D: 1,
        exchange: { type: 'resistance' },
        lines: [
          { role: 'stage', text: 'A small table is cleared.' },
          { role: 'tutor', text: 'Before naming anyone, what has the room actually shown?' },
          { role: 'learner', text: 'It has shown the damage, but not yet the hand behind it.' },
        ],
      },
      {
        turn: 2,
        D: finalD,
        exchange: { type: 'assertion' },
        lines: [
          { role: 'stage', text: 'The last note is opened.' },
          { role: 'tutor', text: 'Now hold the two shown lines together.' },
          { role: 'learner', text: 'Then the answer is warranted, and I can say it.' },
        ],
      },
    ],
  };
  const result = {
    worldId: 'fixture_world',
    verdict,
    turnsPlayed: 2,
    firstForcedTurn: 2,
    assertedGroundedTurn: 2,
  };
  const diagnosis = {
    verdict,
    turnsPlayed: 2,
    firstForcedTurn: 2,
    assertedGroundedTurn: 2,
    releaseAdherence: {
      rows: [{ premise: 'safe_fixture', plannedTurn: 2, actualTurn: 2, status: 'on_cue' }],
      onCue: 1,
      deviations: [],
      missed: [],
      unscheduled: [],
    },
    scenes: {
      count: 1,
      avgExchanges: 2,
      exchangeTypes: { resistance: 1, assertion: 1 },
      recognitionNeed: { peakDebt: 0 },
      phaticRecognition: { total: 0 },
    },
  };
  fs.writeFileSync(path.join(dir, 'live.json'), `${JSON.stringify(live, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'diagnosis.json'), `${JSON.stringify(diagnosis, null, 2)}\n`);
}

test('parseArgs accepts derivation rubric-suite controls', () => {
  const args = parseArgs([
    '--labels',
    'a,b',
    '--run-dir',
    'exports/runs',
    '--out-dir',
    'exports/out',
    '--rubrics',
    'dialogue_quality,poetics',
    '--judge-cli',
    'none',
    '--force',
  ]);
  assert.deepEqual(args.labels, ['a', 'b']);
  assert.match(args.runDir, /exports\/runs$/u);
  assert.match(args.outDir, /exports\/out$/u);
  assert.deepEqual(args.rubrics, ['dialogue_quality', 'poetics']);
  assert.equal(args.judgeCli, 'none');
  assert.equal(args.force, true);
});

test('scoreDerivationRubricSuite writes proof gate, prompts, and unscored report', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-rubric-suite-'));
  const runDir = path.join(tmp, 'runs');
  const outDir = path.join(tmp, 'out');
  writeRun(runDir, 'fixture-s0');
  writeRun(runDir, 'fixture-s1');

  const manifest = await scoreDerivationRubricSuite({
    labels: ['fixture-s0', 'fixture-s1'],
    runDir,
    outDir,
    rubrics: ['dialogue_quality', 'poetics'],
    judgeCli: 'none',
  });

  assert.equal(manifest.results.length, 2);
  assert.equal(manifest.results[0].proofGate.status, 'pass');
  assert.equal(manifest.results[0].rubrics.dialogue_quality.status, 'not_scored');
  assert.ok(fs.existsSync(path.join(outDir, 'prompts', 'fixture-s0.dialogue_quality.md')));
  assert.ok(fs.existsSync(path.join(outDir, 'prompts', 'fixture-s1.poetics.md')));

  const report = fs.readFileSync(path.join(outDir, 'report.md'), 'utf8');
  assert.match(report, /proof\/problem-solving gate is primary/u);
  assert.match(report, /Dialogue Quality v2\.2/u);
  assert.ok(fs.existsSync(path.join(outDir, 'scores.json')));
});
