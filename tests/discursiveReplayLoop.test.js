import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  parseArgs,
  recognitionPasses,
  summarizePanelScores,
} from '../scripts/run-discursive-replay-loop.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('parseArgs requires an explicit max iteration cap', () => {
  assert.throws(() => parseArgs(['--item-id', 'item-a']), /--max-iterations is required/);
});

test('parseArgs defaults to adversarial local check and all critic concurrency', () => {
  const args = parseArgs(['--item-id', 'item-a,item-b', '--max-iterations', '3']);
  assert.equal(args.maxIterations, 3);
  assert.equal(args.generator, 'codex');
  assert.equal(args.checker, 'adversarial');
  assert.equal(args.itemConcurrency, 2);
  assert.equal(args.criticConcurrency, 'all');
  assert.equal(args.panelThreshold, 'majority');
  assert.equal(args.ingest, true);
});

test('recognitionPasses handles majority, all, numeric threshold, and coverage', () => {
  assert.deepEqual(recognitionPasses({ recognitionVotes: 3, totalCritics: 5 }, 'majority', 5), {
    passes: true,
    requiredRecognitionVotes: 3,
    minimumCoverage: 3,
  });
  assert.equal(recognitionPasses({ recognitionVotes: 4, totalCritics: 5 }, 'all', 5).passes, false);
  assert.equal(recognitionPasses({ recognitionVotes: 4, totalCritics: 5 }, 4, 5).passes, true);
  assert.equal(recognitionPasses({ recognitionVotes: 3, totalCritics: 2 }, 'majority', 5).passes, false);
});

test('summarizePanelScores maps blind ids to source items and flags failures', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-replay-loop-panel-'));
  const scoreDir = path.join(tmp, 'scores');
  writeJson(path.join(tmp, 'manifest.json'), {
    critics: ['codex', 'qwen', 'claude'],
    selected: [
      { tid: 'T01', sourceItemId: 'source-a' },
      { tid: 'T02', sourceItemId: 'source-b' },
    ],
  });
  writeJson(path.join(scoreDir, 'replay-r01-codex.json'), {
    critic: 'codex',
    scored: [
      { id: 'T01', formClass: 'recognition', recontextualization: 100, actionalBreakthrough: 100 },
      { id: 'T02', formClass: 'flat', recontextualization: 50, actionalBreakthrough: 100 },
    ],
  });
  writeJson(path.join(scoreDir, 'replay-r01-qwen.json'), {
    critic: 'qwen',
    scored: [
      { id: 'T01', formClass: 'recognition', recontextualization: 75, actionalBreakthrough: 75 },
      { id: 'T02', formClass: 'recognition', recontextualization: 75, actionalBreakthrough: 75 },
    ],
  });
  writeJson(path.join(scoreDir, 'replay-r01-claude.json'), {
    critic: 'claude',
    scored: [
      { id: 'T01', formClass: 'recognition', recontextualization: 75, actionalBreakthrough: 75 },
      { id: 'T02', formClass: 'flat', recontextualization: 25, actionalBreakthrough: 75 },
    ],
  });

  const summary = summarizePanelScores(tmp, { panelThreshold: 'majority' });
  assert.deepEqual(
    summary.passed.map((item) => item.sourceItemId),
    ['source-a'],
  );
  assert.deepEqual(
    summary.failed.map((item) => item.sourceItemId),
    ['source-b'],
  );
  assert.equal(summary.items[0].recognitionVotes, 3);
  assert.equal(summary.items[1].requiredRecognitionVotes, 2);
});
