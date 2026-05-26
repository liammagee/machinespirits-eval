import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  DEFAULT_MODEL,
  buildScorePlan,
  ensurePlanIncludesCritic,
  parseArgs,
  scoreCommand,
} from '../scripts/score-poetics-missing-sonnet.js';

const tmpRoots = [];

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function touch(p, content = '') {
  mkdirp(path.dirname(p));
  fs.writeFileSync(p, content, 'utf8');
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-sonnet-test-'));
  tmpRoots.push(root);
  return root;
}

afterEach(() => {
  while (tmpRoots.length) fs.rmSync(tmpRoots.pop(), { recursive: true, force: true });
});

describe('score-poetics-missing-sonnet', () => {
  it('derives missing Sonnet jobs from a persisted batch plan', () => {
    const root = makeRoot();
    const targetOut = path.join(root, 'target-r01', 'sample');
    const targetKey = path.join(root, 'target-r01', 'key.yaml');
    const controlOut = path.join(root, 'control-r01', 'd4', 'sample');
    const controlKey = path.join(root, 'control-r01', 'd4', 'key.yaml');
    fs.writeFileSync(
      path.join(root, 'batch-plan.json'),
      JSON.stringify(
        {
          batchId: 'demo-run',
          units: [
            {
              id: 'target-r01',
              outDir: targetOut,
              keyPath: targetKey,
              pairedPolicies: ['none', 'reframe'],
            },
            {
              id: 'control-r01-d4',
              outDir: controlOut,
              keyPath: controlKey,
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    touch(path.join(targetOut, 'none', 'T1.txt'), 'LEARNER: sample');
    touch(path.join(targetOut, 'reframe', 'T1.txt'), 'LEARNER: sample');
    touch(path.join(targetOut, 'prefix-baseline', 'T1.txt'), 'LEARNER: sample');
    touch(path.join(path.dirname(targetKey), 'key-none.yaml'), 'items: {}\n');
    touch(path.join(path.dirname(targetKey), 'key-reframe.yaml'), 'items: {}\n');
    touch(path.join(path.dirname(targetKey), 'key-prefix-baseline.yaml'), 'items: {}\n');
    touch(path.join(controlOut, 'T1.txt'), 'LEARNER: sample');
    touch(controlKey, 'items: {}\n');
    touch(path.join(root, 'scores', 'target-r01-none-anthropic-claude-sonnet-4-6.json'), '{}\n');

    const plan = buildScorePlan({ rootDir: root, model: DEFAULT_MODEL });

    assert.equal(plan.batchId, 'demo-run');
    assert.deepEqual(
      plan.jobs.map((job) => job.id).sort(),
      ['control-r01-d4', 'target-r01-prefix-baseline', 'target-r01-reframe'],
    );
    assert.deepEqual(
      plan.skipped.map((job) => job.id),
      ['target-r01-none'],
    );
    assert.equal(plan.missingInputs.length, 0);
  });

  it('builds the scorer command with the Sonnet model and score concurrency', () => {
    const args = parseArgs(['--run-id', 'phase2-demo', '--score-concurrency', '5']);
    const command = scoreCommand(
      {
        model: DEFAULT_MODEL,
        sampleDir: '/tmp/sample',
        keyPath: '/tmp/key.yaml',
        outPath: '/tmp/out.json',
      },
      args,
    );

    assert.ok(command.includes('scripts/score-poetics-phase2.js'));
    assert.ok(command.includes('--model'));
    assert.ok(command.includes(DEFAULT_MODEL));
    assert.ok(command.includes('--concurrency'));
    assert.ok(command.includes('5'));
  });

  it('records the backfilled critic in batch-plan metadata', () => {
    const root = makeRoot();
    const planPath = path.join(root, 'batch-plan.json');
    fs.writeFileSync(
      planPath,
      JSON.stringify({ batchId: 'demo-run', critics: ['qwen/qwen3.7-max'], units: [] }, null, 2),
      'utf8',
    );

    assert.equal(ensurePlanIncludesCritic(root, DEFAULT_MODEL), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(planPath, 'utf8')).critics, [
      'qwen/qwen3.7-max',
      DEFAULT_MODEL,
    ]);
    assert.equal(ensurePlanIncludesCritic(root, DEFAULT_MODEL), false);
  });
});
