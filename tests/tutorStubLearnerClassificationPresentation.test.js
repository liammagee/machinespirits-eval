import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  projectTutorStubClassifierWorldContext,
  projectTutorStubLearnerClassificationLines,
} from '../services/tutorStubLearnerClassificationPresentation.js';
import { runInteractive } from './helpers/tutorStubInteractiveHarness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({
  cyan: '<cyan>',
  dim: '<dim>',
  red: '<red>',
  reset: '<reset>',
});

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('learner-classifier projection pins pace, tutor cue, warning, and input immutability', () => {
  const presentation = {
    summary: 'The learner distinguishes evidence from inference.',
    requestType: 'conceptual_clarity_request',
    discourseMove: 'repair_request',
    epistemicStance: 'tentative',
    conceptual: 2,
    readiness: 3,
    learningPace: 'accelerating',
    reasoningSpan: 'multi_step',
    overallSummary: 'The learner is actively revising the proof path.',
    pedagogicalNeed: 'Rephrase the residue comparison with one concrete case.',
    warning: 'fixture parse warning',
  };
  const before = structuredClone(presentation);
  const lines = projectTutorStubLearnerClassificationLines(presentation, { colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '018efc0643e1ada791956eff4c352759e62ba7594523df691ad0fa038ec64cfd');
  assert.match(output, /conceptual 2\/5, readiness 3\/5/u);
  assert.match(output, /pace: accelerating; reasoning span: multi_step/u);
  assert.match(output, /tutor cue: Rephrase the residue comparison with one concrete case\./u);
  assert.match(output, /learner-classifier warning<reset><dim>: fixture parse warning/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(presentation, before);
});

test('learner-classifier projection handles absent and normalized minimal presentations', () => {
  assert.deepEqual(projectTutorStubLearnerClassificationLines(null, { colors: COLORS }), []);
  assert.deepEqual(
    projectTutorStubLearnerClassificationLines(
      {
        summary: 'No turn summary.',
        requestType: 'unknown_request',
        discourseMove: 'unknown',
        epistemicStance: 'unknown',
        conceptual: '?',
        readiness: '?',
        learningPace: '',
        reasoningSpan: '',
        overallSummary: 'No overall summary.',
        pedagogicalNeed: '',
        warning: '',
      },
      { colors: COLORS },
    ),
    [
      '<cyan>learner classifier ><reset> No turn summary.',
      '<dim>  request: unknown_request; move: unknown; stance: unknown; conceptual ?/5, readiness ?/5<reset>',
      '<dim>  overall: No overall summary.<reset>',
    ],
  );
});

test('classifier world context preserves no-world fallback, public fields, DAG disclosure, and optional discipline', () => {
  assert.equal(projectTutorStubClassifierWorldContext(null), 'No detective-story world is active.');
  assert.equal(
    projectTutorStubClassifierWorldContext({
      dag: true,
      world: {
        id: 'world_005_marrick',
        title: 'The Marrick Ledger',
        discipline: 'historical inference',
        question: 'Who inherited the archive?',
        setting: '  A damaged ledger sits on the table.  ',
      },
    }),
    [
      'World: world_005_marrick - The Marrick Ledger',
      'Discipline: historical inference',
      'Public question: Who inherited the archive?',
      'Opening situation: A damaged ledger sits on the table.',
      'DAG mode: on, but hidden DAG state is intentionally withheld from this classifier',
    ].join('\n'),
  );
  assert.equal(
    projectTutorStubClassifierWorldContext({
      dag: false,
      world: { id: 'w', title: 'World', question: 'Why?', setting: '' },
    }),
    ['World: w - World', 'Public question: Why?', 'Opening situation: ', 'DAG mode: off'].join('\n'),
  );
});

test('real technical-debug process preserves exact learner-classifier terminal bytes', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-learner-classification-presentation-'));
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
    const block = result.plain.match(/learner classifier >[\s\S]*?(?=tutor learner-DAG model >)/u)?.[0] || '';

    assert.equal(Buffer.byteLength(block), 488);
    assert.equal(sha256(block), '2cb87d9a99f0e6c52383a183c0524f75ade9759f23fa0915a6f8ffc407c98ded');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('the CLI retains learner classification semantics, debug gating, call sites, and terminal ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubLearnerClassificationPresentation.js'),
    'utf8',
  );
  const printSlice = cliSource.slice(
    cliSource.indexOf('function printClassification'),
    cliSource.indexOf('function floorClassifierScore'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubLearnerClassificationPresentation\.js';/u);
  assert.match(cliSource, /async function classifyLearnerInput/u);
  assert.match(cliSource, /parseClassifierJson/u);
  assert.match(cliSource, /printAutomaticTechnicalDetails\(state, \(\) => printClassification\(classification\)\)/u);
  assert.match(printSlice, /scoreValue\(turn\.scores\?\.conceptual_engagement\)/u);
  assert.match(printSlice, /pedagogical_need \|\| overall\.next_best_tutor_move/u);
  assert.match(printSlice, /classification\.error \|\| classification\.parseError/u);
  assert.match(printSlice, /projectTutorStubLearnerClassificationLines/u);
  assert.match(printSlice, /console\.log\(line\)/u);
  assert.doesNotMatch(cliSource, /function classifierWorldContext/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
