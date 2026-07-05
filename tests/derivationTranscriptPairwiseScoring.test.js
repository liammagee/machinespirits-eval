import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseArgs, scorePairwiseTranscriptEval } from '../scripts/score-derivation-transcript-pairwise-eval.js';

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test('pairwise transcript scorer parses CLI args', () => {
  const args = parseArgs([
    '--packet-dir',
    'exports/example-packets',
    '--out',
    'exports/example-packets/scores.json',
    '--report',
    'exports/example-packets/report.md',
    '--judge-cli',
    'claude',
    '--judge-model',
    'sonnet',
    '--judge-effort',
    'max',
    '--force',
    '--dry-run',
  ]);
  assert.equal(args.judgeCli, 'claude');
  assert.equal(args.judgeModel, 'sonnet');
  assert.equal(args.judgeEffort, 'max');
  assert.equal(args.force, true);
  assert.equal(args.dryRun, true);
  assert.match(args.packetDir, /exports\/example-packets$/u);
});

test('pairwise transcript scorer dry-run writes scores and report', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'derivation-pairwise-score-'));
  fs.mkdirSync(path.join(dir, 'pairs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'rubric.md'), '# Rubric\n');
  fs.writeFileSync(path.join(dir, 'pairs/P01.md'), '# Pair P01\n\n## Transcript A\nA\n\n## Transcript B\nB\n');
  writeJson(path.join(dir, 'manifest.json'), {
    schema: 'machinespirits.derivation.blinded_pairwise_transcript_eval.v1',
    pair_count: 1,
    pairs: [{ pair_id: 's0_vs_s1', packet_id: 'P01', packet: 'pairs/P01.md', rubric: 'rubric.md' }],
  });
  writeJson(path.join(dir, 'key.json'), {
    schema: 'machinespirits.derivation.blinded_pairwise_transcript_key.v1',
    pairs: [
      {
        pair_id: 's0_vs_s1',
        packet_id: 'P01',
        assignment: {
          A: 'cast-layer-pairwise-hethel-real-s0-no-cast-r1',
          B: 'cast-layer-pairwise-hethel-real-s1-static-cast-r1',
        },
      },
    ],
  });

  const out = path.join(dir, 'scores.json');
  const report = path.join(dir, 'report.md');
  const result = await scorePairwiseTranscriptEval({
    packetDir: dir,
    out,
    report,
    judgeCli: 'codex',
    judgeModel: null,
    dryRun: true,
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.summary.length, 2);
  assert.equal(result.summary[0].appearances, 1);
  assert.ok(fs.existsSync(out));
  assert.match(fs.readFileSync(report, 'utf8'), /Blinded Pairwise Transcript Comparison/u);
  assert.match(fs.readFileSync(report, 'utf8'), /S0 no cast/u);
  assert.match(fs.readFileSync(report, 'utf8'), /S1 static cast/u);
});
