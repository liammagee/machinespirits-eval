import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluateCastLayerReaderQuality, parseArgs } from '../scripts/evaluate-cast-layer-reader-quality.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MATRIX_DIR = path.join(ROOT, 'exports/dramatic-derivation/cast-layer-local-gate/matrix');

test('parseArgs accepts optional matrix and output directories', () => {
  const args = parseArgs(['--matrix-dir', 'exports/example', '--out-dir', 'exports/out']);
  assert.equal(args.matrixDir, path.join(ROOT, 'exports/example'));
  assert.equal(args.outDir, path.join(ROOT, 'exports/out'));
});

test('cast-layer reader-quality scorer emits conservative rubric and branch scores', { skip: !fs.existsSync(MATRIX_DIR) }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-reader-quality-'));
  const result = evaluateCastLayerReaderQuality({ matrixDir: MATRIX_DIR, outDir: tmp });
  assert.equal(result.scores.length, 3);

  const byId = Object.fromEntries(result.scores.map((score) => [score.id, score]));
  assert.ok(byId.S0);
  assert.ok(byId.S1);
  assert.ok(byId.S2);

  assert.equal(byId.S0.summary.verdict, 'grounded_anagnorisis');
  assert.equal(byId.S2.summary.finalD, 0);
  assert.deepEqual(byId.S2.summary.reinventionTurns.map((turn) => turn.turn), [7]);
  assert.equal(byId.S2.stats.formalismLeaks.length, 0);

  assert.ok(byId.S2.rubrics.derivative_branch_criteria.overall > byId.S1.rubrics.derivative_branch_criteria.overall);
  assert.ok(byId.S1.rubrics.derivative_branch_criteria.overall > byId.S0.rubrics.derivative_branch_criteria.overall);
  assert.equal(
    byId.S2.rubrics.derivative_branch_criteria.dimensions.bounded_reinvention.score,
    5,
  );

  const dialogueSpread = Math.max(
    ...result.scores.map((score) => score.rubrics.dialogue_quality_proxy.overall),
  ) - Math.min(...result.scores.map((score) => score.rubrics.dialogue_quality_proxy.overall));
  assert.ok(dialogueSpread <= 5, `expected nearly flat dialogue-quality proxy scores, got spread ${dialogueSpread}`);

  const report = fs.readFileSync(path.join(tmp, 'report.md'), 'utf8');
  assert.match(report, /not yet mature as demonstrated reader-quality improvement/u);
  assert.match(report, /S2 proves one bounded reinvention event/u);
  assert.ok(fs.existsSync(path.join(tmp, 'scores.json')));
});
