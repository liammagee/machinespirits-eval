import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { analyzeLearnerDagBatch, parseArgs } from '../scripts/analyze-derivation-learner-dag-batch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_PATH = path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml');

function writeRun(runDir, label, { complete }) {
  const dir = path.join(runDir, label);
  fs.mkdirSync(dir, { recursive: true });
  const ledger = [
    { turn: 2, premiseId: 'p1', via: 'director' },
    { turn: 5, premiseId: 'p2', via: 'tutor' },
    { turn: 8, premiseId: 'p3', via: 'tutor' },
  ];
  const transcript = complete
    ? [
        {
          turn: 2,
          role: 'learner',
          text: 'Marin is Tessa child.',
          meta: { adopt: [['child', 'marin', 'tessa']] },
        },
        {
          turn: 5,
          role: 'learner',
          text: 'Tessa is founder child.',
          meta: { adopt: [['child', 'tessa', 'founder']] },
        },
        {
          turn: 8,
          role: 'learner',
          text: 'Marin bears the mark, so Marin is heir.',
          meta: {
            adopt: [['bearsMark', 'marin']],
            derive: [
              ['grandchild', 'marin', 'founder'],
              ['heir', 'marin'],
            ],
            deriveOutcomes: [{ status: 'voiced' }, { status: 'voiced' }],
            asserts: ['heir', 'marin'],
          },
        },
      ]
    : [
        {
          turn: 2,
          role: 'learner',
          text: 'Marin is Tessa child.',
          meta: { adopt: [['child', 'marin', 'tessa']] },
        },
      ];
  const result = {
    worldId: 'world_000_smoke',
    verdict: complete ? 'grounded_anagnorisis' : 'aporia',
    turnsPlayed: complete ? 8 : 3,
    firstForcedTurn: complete ? 8 : null,
    assertedGroundedTurn: complete ? 8 : null,
    ledger,
    transcript,
    trajectory: [{ turn: complete ? 8 : 3, D: complete ? 0 : 2 }],
  };
  const diagnosis = {
    worldPath: path.relative(ROOT, WORLD_PATH),
    worldId: 'world_000_smoke',
    verdict: result.verdict,
    turnsPlayed: result.turnsPlayed,
    firstForcedTurn: result.firstForcedTurn,
    assertedGroundedTurn: result.assertedGroundedTurn,
    dCurve: [complete ? 0 : 2],
    releaseAdherence: { onCue: complete ? 3 : 1, deviations: [], missed: [], unscheduled: [] },
  };
  fs.writeFileSync(path.join(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'diagnosis.json'), `${JSON.stringify(diagnosis, null, 2)}\n`);
}

test('parseArgs accepts batch diagnostic controls', () => {
  const opts = parseArgs(['--run-dir', 'runs', '--out-dir', 'out', '--labels', 'a,b', '--limit', '2']);
  assert.equal(path.basename(opts.runDir), 'runs');
  assert.equal(path.basename(opts.outDir), 'out');
  assert.deepEqual(opts.labels, ['a', 'b']);
  assert.equal(opts.limit, 2);
  assert.throws(() => parseArgs(['--limit', '0']), /positive number/u);
});

test('analyzeLearnerDagBatch writes aggregate summary and report', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-dag-batch-'));
  const runDir = path.join(tmp, 'runs');
  const outDir = path.join(tmp, 'out');
  writeRun(runDir, 'complete-run', { complete: true });
  writeRun(runDir, 'partial-run', { complete: false });

  const summary = analyzeLearnerDagBatch({ runDir, outDir });

  assert.equal(summary.aggregate.assessed, 2);
  assert.equal(summary.aggregate.skipped, 0);
  assert.equal(summary.aggregate.completePathRate, 0.5);
  assert.equal(summary.aggregate.finalSecretEntailedRate, 0.5);
  assert.equal(summary.aggregate.assertedSecretRate, 0.5);
  assert.equal(summary.aggregate.bottleneckCounts.grounded_asserted_secret, 1);
  assert.equal(summary.aggregate.bottleneckCounts.release_or_pacing_gap, 1);
  assert.equal(summary.aggregate.missingPremiseCounts.find((row) => row.premiseId === 'p2').buckets.unreleased, 1);
  assert.ok(fs.existsSync(path.join(outDir, 'summary.json')));
  const report = fs.readFileSync(path.join(outDir, 'report.md'), 'utf8');
  assert.match(report, /Learner DAG Batch Diagnostic/u);
  assert.match(report, /release_or_pacing_gap/u);
  assert.match(report, /complete-run/u);
});
