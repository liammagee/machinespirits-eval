import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubLearnerDagLines } from '../services/tutorStubLearnerDagPresentation.js';
import { runInteractive } from './helpers/tutorStubInteractiveHarness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({
  cyan: '<cyan>',
  dim: '<dim>',
  brightGreen: '<bright-green>',
  red: '<red>',
  reset: '<reset>',
});

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('learner-DAG projection pins dropout, accepted movement, acceleration, warnings, and immutability', () => {
  const result = {
    model: {
      metrics: {
        groundedCount: 3,
        voicedDerivedCount: 2,
        hypothesisCount: 1,
        answerCandidateCount: 1,
      },
      assessment: {
        bestPathCoverage: 0.75,
        bottleneck: 'missing_mark',
        missingPremiseBuckets: { unreleased: 2, misunderstood: 1 },
      },
    },
    dagFactDropout: {
      droppedNow: ['p1', 'p2'],
      repairedNow: ['p3'],
      activeDropped: ['p1'],
    },
    accepted: { adopt: ['p4'], derive: [['grandchild', 'marin', 'founder']], hypothesis: ['heir', 'marin'] },
    advance: { accelerated: true, supportedMoveCount: 3 },
    extractor: { parseError: 'fixture parse warning' },
  };
  const before = structuredClone(result);
  const lines = projectTutorStubLearnerDagLines(result, { colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '93bee0ba92bea019b7309e8fb5746641075ca6730df9ea730d62fde14b06e124');
  assert.match(output, /coverage 0\.75; bottleneck missing_mark/u);
  assert.match(output, /2 slipped now; 1 re-adopted; 1 currently dropped/u);
  assert.match(output, /missing unreleased:2, misunderstood:1/u);
  assert.match(output, /update: adopted 1, derived 1, hypothesis noted/u);
  assert.match(output, /learner pace: accelerating — 3 warranted proof moves/u);
  assert.match(output, /learner-DAG model warning<reset><dim>: fixture parse warning/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(result, before);
});

test('learner-DAG projection handles absent and minimal models without inventing diagnostics', () => {
  assert.deepEqual(projectTutorStubLearnerDagLines(null, { colors: COLORS }), []);
  assert.deepEqual(projectTutorStubLearnerDagLines({}, { colors: COLORS }), []);
  assert.deepEqual(projectTutorStubLearnerDagLines({ model: {} }, { colors: COLORS }), [
    '<cyan>tutor learner-DAG model ><reset> coverage n/a; bottleneck unknown',
    '<dim>  grounded 0, voiced 0, hypotheses 0, answer candidates 0<reset>',
  ]);
});

test('real technical-debug process preserves exact learner-DAG terminal bytes', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-learner-dag-presentation-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--dag',
        '--tutor-learner-dag',
        '--world',
        'world_005_marrick',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-turn-feedback',
        '--no-remember-settings',
        '--no-color',
      ],
      initialInput: '/debug on technical\n',
      followupInputs: [
        {
          afterPlainIncludes: 'debug > on · technical details',
          text: 'What does the residue comparison mean?\n',
        },
      ],
      stopWhen: (plain) => plain.includes('engagement stance >'),
      timeoutMs: 15_000,
      env: {
        FAKE_CODEX_VALID_ANALYSIS: '1',
        NO_COLOR: '1',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
    });
    const block = result.plain.match(/tutor learner-DAG model >[\s\S]*?(?=engagement stance >)/u)?.[0] || '';

    assert.equal(Buffer.byteLength(block), 336);
    assert.equal(sha256(block), 'ecb8c2bf55b237cb4b4de52f002e71daf742a46c8a9ff020b964452b48cc9603');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('the CLI retains learner-DAG construction, debug gating, call sites, and terminal ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubLearnerDagPresentation.js'), 'utf8');
  const printSlice = cliSource.slice(
    cliSource.indexOf('function printTutorLearnerDagModel'),
    cliSource.indexOf('function printResponseConfigurationSelection'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubLearnerDagPresentation\.js';/u);
  assert.match(cliSource, /function buildTutorLearnerDagForTurn/u);
  assert.match(cliSource, /buildTutorLearnerDagModel/u);
  assert.match(cliSource, /printAutomaticTechnicalDetails\(state, \(\) => printTutorLearnerDagModel\(result\)\)/u);
  assert.match(printSlice, /projectTutorStubLearnerDagLines/u);
  assert.match(printSlice, /console\.log\(line\)/u);
  assert.doesNotMatch(printSlice, /missingPremiseBuckets|dagFactDropout|supportedMoveCount/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
