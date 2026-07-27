import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubResponseConfigurationLines } from '../services/tutorStubResponseConfigurationPresentation.js';
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

test('response-configuration projection pins efficacy and the complete normalized selection', () => {
  const presentation = {
    previousEfficacy: {
      engagement_stance: 'warm',
      label: 'helpful',
      mismatch: 'stance mismatch',
      summary: 'the learner advanced',
      learnerFeedback: { rating: 'up' },
      selfAssessmentLabel: 'strong',
    },
    fieldDelta: '+0.125',
    selection: {
      engagement_stance: 'precise',
      confidence: 0.73,
      source: 'classifier',
      warning: 'fixture warning',
      light_adaptation: { triggered: true, streak: 3 },
      policy_composition: { policy_stack: 'dynamic+guard', overlay_threshold: 0.6, activated_overlay: 'safety' },
      continuous_register_policy: { dominant_blend: 'precise 60% + warm 40%', entropy_bits: 0.971 },
      request_type: 'clarity',
      action_family: 'clarify_distinction',
      reviewer_signal: 'repair',
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      scene_immersion: 'grounded',
      actorial_part_label: 'evidence examiner',
      actorial_part_selection: { reason: 'fixture reason' },
      register_reason: 'Choose the bounded repair.',
      expected_dag_move: 'Adopt the warranted premise.',
      expected_field_move: 'Increase grounded confidence.',
      activated_policy: 'state',
    },
    distribution: 'precise:60%, warm:40%',
    partDistribution: 'examiner 75%, advocate 25%',
  };
  const before = structuredClone(presentation);
  const lines = projectTutorStubResponseConfigurationLines(presentation, { colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '01a975f003828e8a9f41b9727b4906eabeffc39313add49d3f2c9b628f18f9ad');
  assert.match(output, /stance efficacy ><reset> warm helpful; stance mismatch; field \+0\.125/u);
  assert.match(output, /explicit learner rating: 👍 helpful; self-assessment strong/u);
  assert.match(output, /light adaptation: continued confusion\/frustration streak 3/u);
  assert.match(output, /policy stack: dynamic\+guard; overlay threshold 0\.6; activated safety/u);
  assert.match(output, /continuous blend: precise 60% \+ warm 40%; entropy 0\.971 bits/u);
  assert.match(output, /expected state move: Increase grounded confidence\./u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(presentation, before);
});

test('response-configuration projection handles absent, efficacy-only, and compact selection inputs', () => {
  assert.deepEqual(projectTutorStubResponseConfigurationLines(), []);
  assert.deepEqual(
    projectTutorStubResponseConfigurationLines(
      {
        previousEfficacy: {
          engagement_stance: 'plain',
          label: 'mixed',
          mismatch: '',
          summary: 'no measured change',
          selfAssessmentLabel: 'unknown',
        },
        fieldDelta: '0',
      },
      { colors: COLORS },
    ),
    ['<cyan>stance efficacy ><reset> plain mixed (no measured change)'],
  );

  const compact = {
    selection: {
      engagement_stance: 'warm',
      confidence: null,
      random_performance: { enabled: true },
    },
    distribution: '',
    partDistribution: null,
  };
  assert.deepEqual(projectTutorStubResponseConfigurationLines(compact, { colors: COLORS }), [
    '<cyan>engagement stance ><reset> warm',
    '<dim>  random performance: stance and host character sampled independently of learner assessment; action and safety controls retained<reset>',
    '<dim>  audience: unknown; lexical: unknown; scene: unknown; part: unknown<reset>',
  ]);
});

test('response-configuration projection distinguishes adaptive temperature from random performance', () => {
  const presentation = {
    selection: {
      engagement_stance: 'precise',
      confidence: null,
      temperature: 0.15,
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'standard',
      scene_immersion: 'grounded',
      actorial_part: 'examiner',
    },
  };
  const output = terminalBytes(projectTutorStubResponseConfigurationLines(presentation, { colors: COLORS }));

  assert.match(output, /adaptive-performance temperature: 0\.15/u);
  assert.doesNotMatch(output, /random performance|light adaptation/u);
});

test('real technical-debug process preserves exact response-configuration terminal bytes', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-response-configuration-presentation-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--register-policy',
        'random',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
        '--no-color',
      ],
      initialInput: '/debug on technical\nThe assay still confuses me.\n',
      stopWhen: (plain) => plain.includes('debug explain > turn 1'),
      timeoutMs: 15_000,
      env: {
        NO_COLOR: '1',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
    });
    const block = result.plain.match(/engagement stance >[\s\S]*?(?=codex\/)/u)?.[0] || '';

    assert.equal(Buffer.byteLength(block), 949);
    assert.equal(sha256(block), '9ee64b109d7b735ef9fbd74ff3bef61d1e1b1944be94cb4ab1a9ff5fe21ef0b6');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('the CLI retains response-policy normalization, debug gating, call sites, and terminal ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubResponseConfigurationPresentation.js'),
    'utf8',
  );
  const normalizationSlice = cliSource.slice(
    cliSource.indexOf('function responseConfigurationPresentation'),
    cliSource.indexOf('function responseConfigurationContext'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubResponseConfigurationPresentation\.js';/u);
  assert.match(cliSource, /printAutomaticTechnicalDetails\(state, \(\) =>\s*printResponseConfigurationSelection/u);
  assert.match(normalizationSlice, /formatSignedInterimNumber/u);
  assert.match(normalizationSlice, /formatEngagementStanceDistribution/u);
  assert.match(normalizationSlice, /displayDiagnosticLabel/u);
  assert.match(normalizationSlice, /projectTutorStubResponseConfigurationLines/u);
  assert.match(normalizationSlice, /console\.log\(line\)/u);
  assert.match(serviceSource, /effectivePolicy === 'state'/u);
  assert.match(serviceSource, /selection\.light_adaptation\?\.triggered/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
