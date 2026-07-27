import { createHash } from 'node:crypto';

import {
  projectTutorStubFieldVisualizationLines,
  projectTutorStubLightweightFieldLines,
} from '../services/tutorStubFieldPresentation.js';
import { assert, fs, os, path, ROOT, runInteractive, test } from './helpers/tutorStubInteractiveHarness.js';

const COLORS = { cyan: '<cyan>', dim: '<dim>', reset: '</>' };
const LIVE_FIELD_REPORT_HASH = 'c6184f8be4613395862fc73defc9e0f26b6edc6749ac0995ba22c80f0a08b780';

function denseField() {
  return {
    schema: 'machinespirits.tutor-stub.lightweight-field.v1',
    turnCount: 2,
    rows: [
      {
        turn: 1,
        learnerMastery: 0.2,
        learnerRisk: 0.6,
        tutorAlignment: 0.5,
        jointMomentum: 0.1,
        learnerMove: 'question',
        register: 'guided_discovery',
        bottleneck: 'missing_public_rule',
      },
      {
        turn: 2,
        learnerMastery: 0.5,
        learnerRisk: 0.3,
        tutorAlignment: 0.65,
        jointMomentum: 0.4,
        learnerMove: 'inference',
        register: null,
        bottleneck: 'candidate_conclusion',
      },
    ],
    summary: {
      meanSpeed: 0.211,
      fieldDelta: {
        learnerMastery: 0.3,
        learnerRisk: -0.3,
        tutorAlignment: 0.15,
        jointMomentum: 0.3,
      },
      final: {
        learnerMastery: 0.5,
        learnerRisk: 0.3,
        tutorAlignment: 0.65,
        jointMomentum: 0.4,
        coverage: 0.75,
        bottleneck: 'candidate_conclusion',
      },
    },
  };
}

test('field report projection preserves dense ordering, wording, bars, colors, and immutability', () => {
  const field = denseField();
  const before = structuredClone(field);
  const lines = projectTutorStubLightweightFieldLines(field, { colors: COLORS });

  assert.deepEqual(field, before, 'presentation must not mutate the field projection');
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(lines, [
    '<cyan>field ></> 2 turn lightweight interaction field',
    '<dim>  final: mastery 0.5, risk 0.3, alignment 0.65, momentum 0.4, coverage 0.75</>',
    '<dim>  delta: mastery +0.3, risk -0.3, alignment +0.15, momentum +0.3; mean speed 0.211</>',
    '<dim>  bottleneck: candidate_conclusion</>',
    '<dim>  turn | mastery        | risk           | align          | momentum       | move / register / bottleneck</>',
    '<dim>     1 | ##.......... 0.20 | #######..... 0.60 | ######...... 0.50 | #........... 0.10 | question / guided_discovery / missing_public_rule</>',
    '<dim>     2 | ######...... 0.50 | ####........ 0.30 | ########.... 0.65 | #####....... 0.40 | inference / no-register / candidate_conclusion</>',
    '',
  ]);
});

test('field and visualization reports preserve no-turn, path, newline, fallback, and truncation contracts', () => {
  assert.deepEqual(projectTutorStubLightweightFieldLines(null, { colors: COLORS }), [
    '<cyan>field ></> no completed turns yet',
    '<dim>  enter a learner turn first, or run with --resume-last and then use /field</>\n',
  ]);
  assert.deepEqual(projectTutorStubFieldVisualizationLines(null, { colors: COLORS }), [
    '<cyan>viz ></> no completed turns yet',
    '<dim>  enter a learner turn first, or run with --resume-last and then use /viz</>\n',
  ]);
  assert.deepEqual(
    projectTutorStubFieldVisualizationLines(
      { svgDisplayPath: 'traces/run-field.svg', jsonDisplayPath: 'traces/run-field.json' },
      { colors: COLORS },
    ),
    ['<cyan>viz ></> traces/run-field.svg', '<dim>  data: traces/run-field.json</>\n'],
  );

  const field = denseField();
  field.summary.final.bottleneck = null;
  field.rows = [
    {
      ...field.rows[0],
      learnerMove: 'x'.repeat(120),
      register: null,
      bottleneck: null,
    },
  ];
  const lines = projectTutorStubLightweightFieldLines(field);
  assert.equal(lines[3], '  bottleneck: unknown');
  assert.equal(lines.at(-2).endsWith(`${'x'.repeat(93)}...`), true);
});

test('the CLI retains field calculation, visualization effects, and trace ownership while live reports stay byte-identical', async () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubFieldPresentation.js'), 'utf8');
  const fieldSlice = cliSource.slice(
    cliSource.indexOf('function printLightweightDialogueField'),
    cliSource.indexOf('\nfunction fieldVizBasePath', cliSource.indexOf('function printLightweightDialogueField')),
  );
  const visualizationSlice = cliSource.slice(
    cliSource.indexOf('function printFieldVisualization'),
    cliSource.indexOf('\nfunction printDialogueCloseout', cliSource.indexOf('function printFieldVisualization')),
  );

  assert.match(fieldSlice, /buildLightweightDialogueField/u);
  assert.match(fieldSlice, /projectTutorStubLightweightFieldLines/u);
  assert.doesNotMatch(fieldSlice, /mean speed|move \/ register \/ bottleneck|toFixed/u);
  assert.match(visualizationSlice, /writeFieldVisualization/u);
  assert.match(visualizationSlice, /projectTutorStubFieldVisualizationLines/u);
  assert.doesNotMatch(visualizationSlice, /no completed turns yet|data:/u);
  assert.doesNotMatch(serviceSource, /\b(?:console|fs|process|fetch)\s*\./u);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-field-report-live-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--model',
        'codex.gpt-5.6-terra',
        '--settings-file',
        path.join(tmp, 'settings.json'),
        '--world',
        'none',
        '--no-opening',
        '--no-classifier',
        '--no-register-selection',
        '--no-stream',
        '--no-interim-animation',
        '--no-closeout-report',
        '--no-turn-feedback',
        '--no-remember-settings',
        '--trace-dir',
        tmp,
      ],
      initialInput: 'I would compare the residue before naming a person.\n',
      followupInputs: [{ afterPlainIncludes: 'tutor >', text: '/field\n/viz\n' }],
      stopWhen: (plain) => plain.includes('data:') && plain.includes('-field.json'),
      timeoutMs: 15_000,
      env: { TUTOR_STUB_SUMMARY_OPEN: '0', TUTOR_STUB_REMEMBER_SETTINGS: '0' },
    });
    const fieldStart = result.plain.indexOf('field >');
    const fieldEnd = result.plain.indexOf('\ntutor ↻ >', fieldStart);
    const vizStart = result.plain.indexOf('viz >', fieldEnd);
    const vizEnd = result.plain.indexOf('\ntutor ↻ >', vizStart);
    assert.notEqual(fieldStart, -1, result.plain);
    assert.notEqual(fieldEnd, -1, result.plain);
    assert.notEqual(vizStart, -1, result.plain);
    assert.notEqual(vizEnd, -1, result.plain);
    const normalized = `${result.plain.slice(fieldStart, fieldEnd).trimEnd()}\n---viz---\n${result.plain
      .slice(vizStart, vizEnd)
      .trimEnd()}`
      .replaceAll(path.relative(ROOT, tmp), '<tmp>')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-field/gu, '<run>-field');
    assert.equal(Buffer.byteLength(normalized), 505);
    assert.equal(createHash('sha256').update(normalized).digest('hex'), LIVE_FIELD_REPORT_HASH);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
