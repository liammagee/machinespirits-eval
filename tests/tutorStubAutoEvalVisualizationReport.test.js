import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
  animatedVizReportPayload,
  escapeHtml,
  renderAnimatedVizSection,
  reportRowId,
} from '../services/tutorStubAutoEvalVisualizationReport.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function safeSlug(value) {
  return String(value || 'run')
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

function fieldRowTitle(row) {
  return `${row.policy} run ${row.runIndex}`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const dependencies = { safeSlug, fieldRowTitle };
const populatedRows = [
  {
    policy: 'field',
    runIndex: 1,
    status: 'ok',
    groundedClosure: true,
    stopReason: 'grounded_asserted_secret',
    turnCount: 2,
    trace: 'logs/field-run.jsonl',
    animatedViz: {
      turnCount: 2,
      registerPalette: ['warm', 'precise'],
      dynamicsAxes: ['momentum', 'risk'],
      layers: { state: true, field: true, trajectory: true, dynamicalSystem: false, registers: true },
      frames: [
        {
          turn: 1,
          selectedRegister: 'warm',
          state: { dag: { bottleneck: 'missing_premise' } },
          field: { learnerMastery: 0.3, learnerRisk: 0.6, tutorAlignment: 0.5, jointMomentum: 0.2 },
          dynamics: { stateVector: { momentum: 0.2, risk: 0.6 }, derivativeVector: {} },
          register: { distribution: [{ register: 'warm', probability: 0.7 }] },
          snippets: { learner: 'I am not sure.', tutor: 'Let us inspect the clue.' },
        },
        {
          turn: 2,
          selectedRegister: 'precise',
          state: { dag: { bottleneck: 'grounded_asserted_secret' } },
          field: { learnerMastery: 0.8, learnerRisk: 0.2, tutorAlignment: 0.9, jointMomentum: 0.7 },
          dynamics: { stateVector: { momentum: 0.7, risk: 0.2 }, derivativeVector: {} },
          register: { distribution: [{ register: 'precise', probability: 0.8 }] },
          snippets: { learner: 'The evidence now fits.', tutor: 'State the conclusion.' },
        },
      ],
    },
  },
  {
    policy: 'bland',
    runIndex: 2,
    status: 'ok',
    groundedClosure: false,
    stopReason: 'safety_horizon',
    turnCount: 1,
    trace: 'logs/bland-run.jsonl',
    animatedViz: {
      turnCount: 1,
      registerPalette: ['plain'],
      dynamicsAxes: ['momentum'],
      layers: { state: true, field: true, trajectory: true, dynamicalSystem: false, registers: true },
      frames: [
        {
          turn: 1,
          selectedRegister: 'plain',
          state: { dag: { bottleneck: 'learner_integration_gap' } },
          field: { learnerMastery: 0.4, learnerRisk: 0.4, tutorAlignment: 0.5, jointMomentum: 0.1 },
          dynamics: { stateVector: { momentum: 0.1 }, derivativeVector: {} },
          register: { distribution: [{ register: 'plain', probability: 1 }] },
          snippets: { learner: '<still unsure>', tutor: 'Continue.' },
        },
      ],
    },
  },
];

test('empty visualization fragment preserves its pre-extraction byte contract', () => {
  const html = renderAnimatedVizSection([], dependencies);

  assert.equal(Buffer.byteLength(html), 83);
  assert.equal(sha256(html), '742b174eb670dba7393b4bb4d66992145e3ed7da0285f1407230cae00ae9baf0');
  assert.equal(renderAnimatedVizSection([], dependencies), html);
});

test('populated visualization fragment preserves bytes, payload identity, and inline syntax', () => {
  const html = renderAnimatedVizSection(populatedRows, dependencies);
  const payload = animatedVizReportPayload(populatedRows, dependencies);

  assert.equal(Buffer.byteLength(html), 51_443);
  assert.equal(sha256(html), 'ca2e986a42d00727464e0c8f7ec9f87a1419475b556afbf028be62970936da37');
  assert.deepEqual(
    payload.rows.map(({ id, title }) => ({ id, title })),
    [
      { id: 'viz-01-field-r1-field-run', title: 'field run 1' },
      { id: 'viz-02-bland-r2-bland-run', title: 'bland run 2' },
    ],
  );
  assert.match(html, /\\u003cstill unsure\\u003e/u);
  const runtime = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*$/u)?.[1];
  assert.ok(runtime);
  assert.doesNotThrow(() => new vm.Script(runtime));
  assert.equal(renderAnimatedVizSection(populatedRows, dependencies), html);
});

test('visualization projection preserves empty identity and nullable metadata fallbacks', () => {
  const payload = animatedVizReportPayload([{ animatedViz: { frames: [{}] } }], dependencies);

  assert.equal(escapeHtml(null), '');
  assert.equal(reportRowId({}, 0, 'row', safeSlug), 'row-01-policy-rx-run');
  assert.equal(payload.rows[0].stopReason, null);
  assert.equal(payload.rows[0].trace, null);
});

test('visualization owner remains presentation-only and the executable delegates to it', () => {
  const owner = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubAutoEvalVisualizationReport.js'), 'utf8');
  const executable = fs.readFileSync(path.join(ROOT, 'scripts', 'run-tutor-stub-auto-eval.js'), 'utf8');

  assert.match(owner, /^import path from 'node:path';$/mu);
  assert.doesNotMatch(owner, /node:(?:fs|child_process)|\b(?:process|fetch|console)\s*\./u);
  assert.match(owner, /^export function renderAnimatedVizSection\(/mu);
  assert.match(executable, /tutorStubAutoEvalVisualizationReport\.js/u);
  assert.doesNotMatch(executable, /^function renderAnimatedVizSection\(/mu);
});
