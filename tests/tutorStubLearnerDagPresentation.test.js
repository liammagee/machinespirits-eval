import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  projectTutorStubLearnerDagLines,
  projectTutorStubLearnerDagPromptSummary,
} from '../services/tutorStubLearnerDagPresentation.js';
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

test('learner-DAG prompt summary preserves bounded record history and fallback fields', () => {
  const model = {
    turn: 7,
    metrics: { groundedCount: 9 },
    assessment: { bottleneck: 'p9' },
    memoryReliability: { activeDroppedCount: 1 },
    learnerRecord: {
      grounded: Array.from({ length: 10 }, (_, index) => `p${index + 1}`),
      voicedDerived: Array.from({ length: 10 }, (_, index) => `d${index + 1}`),
      hypotheses: Array.from({ length: 7 }, (_, index) => `h${index + 1}`),
      answerCandidates: ['Marrick'],
    },
  };
  const summary = JSON.parse(projectTutorStubLearnerDagPromptSummary(model));

  assert.equal(summary.turn, 7);
  assert.deepEqual(summary.metrics, { groundedCount: 9 });
  assert.deepEqual(summary.learnerRecord.grounded, ['p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']);
  assert.deepEqual(summary.learnerRecord.voicedDerived, ['d3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10']);
  assert.deepEqual(summary.learnerRecord.hypotheses, ['h3', 'h4', 'h5', 'h6', 'h7']);
  assert.deepEqual(summary.learnerRecord.answerCandidates, ['Marrick']);
  assert.equal(
    projectTutorStubLearnerDagPromptSummary(null),
    'No prior tutor-side learner-DAG model is available yet.',
  );
  assert.deepEqual(JSON.parse(projectTutorStubLearnerDagPromptSummary({})), {
    turn: null,
    metrics: {},
    assessment: {},
    memoryReliability: null,
    learnerRecord: { grounded: [], voicedDerived: [], hypotheses: [], answerCandidates: [] },
  });
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

test('the learner-analysis runtime owns learner-DAG construction and delegates terminal output', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const runtimeSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubLearnerAnalysisRuntime.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubLearnerDagPresentation.js'), 'utf8');
  const printSlice = runtimeSource.slice(
    runtimeSource.indexOf('function printTutorLearnerDagModel'),
    runtimeSource.indexOf('async function buildTutorLearnerDagForTurn'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubLearnerDagPresentation\.js';/u);
  assert.doesNotMatch(cliSource, /function buildTutorLearnerDagForTurn/u);
  assert.match(runtimeSource, /function buildTutorLearnerDagForTurn/u);
  assert.match(runtimeSource, /buildTutorLearnerDagModel/u);
  assert.match(runtimeSource, /printAutomaticTechnicalDetails\(state, \(\) => printTutorLearnerDagModel\(result\)\)/u);
  assert.match(printSlice, /projectTutorStubLearnerDagLines/u);
  assert.match(printSlice, /printLine\(line\)/u);
  assert.doesNotMatch(printSlice, /missingPremiseBuckets|dagFactDropout|supportedMoveCount/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
  assert.doesNotMatch(cliSource, /function learnerDagPromptSummary/u);
});
