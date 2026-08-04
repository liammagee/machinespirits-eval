import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  describeTutorStubFieldShift,
  renderTutorStubLightweightFieldSvg,
  summarizeTutorStubFieldShift,
  tutorStubEscapeFieldXml,
  tutorStubFieldBar,
  tutorStubFieldDelta,
  tutorStubFieldPolyline,
  tutorStubFieldTurnMarkers,
  tutorStubSignedFieldDelta,
} from '../services/tutorStubFieldPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FIRST = Object.freeze({
  turn: 1,
  learnerMastery: 0.2,
  learnerRisk: 0.6,
  tutorAlignment: 0.5,
  jointMomentum: 0.1,
  learnerMove: 'question',
  register: 'guided_discovery',
  bottleneck: 'missing_public_rule',
});

const PREVIOUS = Object.freeze({
  turn: 2,
  learnerMastery: 0.35,
  learnerRisk: 0.45,
  tutorAlignment: 0.55,
  jointMomentum: 0.25,
  learnerMove: 'hypothesis',
  register: 'evidence_coach',
  bottleneck: 'missing_warrant',
});

const CURRENT = Object.freeze({
  turn: 3,
  learnerMastery: 0.5,
  learnerRisk: 0.3,
  tutorAlignment: 0.65,
  jointMomentum: 0.4,
  learnerMove: 'inference',
  register: 'evidence_coach',
  bottleneck: 'candidate_conclusion',
});

test('field numeric presentation preserves rounding, clamping, and the established baseline sentinel', () => {
  assert.equal(tutorStubFieldDelta(0.7549, 0.2499), 0.505);
  assert.equal(tutorStubFieldDelta(undefined, 0.25), -0.25);
  assert.equal(tutorStubFieldBar(0.5, { width: 4 }), '##..');
  assert.equal(tutorStubFieldBar(-1, { width: 4 }), '....');
  assert.equal(tutorStubFieldBar(2, { width: 4 }), '####');
  assert.equal(tutorStubFieldBar('not-a-number', { width: 4 }), '....');
  assert.equal(tutorStubSignedFieldDelta(0.5, 0.25), '+0.25');
  assert.equal(tutorStubSignedFieldDelta(0.25, 0.5), '-0.25');
  assert.equal(tutorStubSignedFieldDelta(0.25, 0), 'baseline');
});

test('field XML presentation escapes every authored and generated label boundary', () => {
  assert.equal(tutorStubEscapeFieldXml(`A&B < "C" > 'D'`), 'A&amp;B &lt; &quot;C&quot; &gt; &apos;D&apos;');
  assert.equal(tutorStubEscapeFieldXml(null), '');
});

test('field shift summary pins previous and total delta grammar', () => {
  assert.equal(summarizeTutorStubFieldShift(FIRST), 'prev baseline; total baseline');
  assert.equal(
    summarizeTutorStubFieldShift(CURRENT, PREVIOUS, FIRST),
    'prev M +0.15, R -0.15, A +0.1, P +0.15; total M +0.3, R -0.3, A +0.15, P +0.3',
  );
});

test('field shift descriptions preserve pace, direction, threshold tags, and bottleneck fallbacks', () => {
  assert.equal(
    describeTutorStubFieldShift(
      {
        ...FIRST,
        bottleneck: null,
        learnerAdvance: { accelerated: true, supportedMoveCount: 3 },
      },
      null,
      { final: { bottleneck: 'summary_bottleneck' } },
    ),
    'accelerating learner span (3 warranted moves); baseline field frame; bottleneck summary_bottleneck',
  );
  assert.equal(
    describeTutorStubFieldShift(CURRENT, PREVIOUS),
    'productive: learner mastery rising; risk easing; tutor alignment improving; joint momentum gaining; bottleneck candidate_conclusion',
  );
  assert.equal(
    describeTutorStubFieldShift(
      { ...CURRENT, learnerMastery: 0.4, learnerRisk: 0.55, tutorAlignment: 0.55, jointMomentum: 0.25 },
      PREVIOUS,
    ),
    'productive but strained: learner mastery rising; risk increasing; bottleneck candidate_conclusion',
  );
  assert.equal(
    describeTutorStubFieldShift(
      { ...CURRENT, learnerMastery: 0.3, learnerRisk: 0.55, tutorAlignment: 0.45, jointMomentum: 0.15 },
      PREVIOUS,
    ),
    'stalled or risk-heavy: risk increasing; tutor alignment weakening; joint momentum slowing; bottleneck candidate_conclusion',
  );
  assert.equal(
    describeTutorStubFieldShift(
      { ...CURRENT, learnerMastery: 0.35, learnerRisk: 0.4, tutorAlignment: 0.55, jointMomentum: 0.25 },
      PREVIOUS,
    ),
    'stabilizing: risk easing; bottleneck candidate_conclusion',
  );
});

test('field chart geometry preserves clamping, coordinates, and escaped marker titles', () => {
  const rows = [
    { turn: 1, learnerMastery: 0.25, learnerMove: 'ask <why>', register: null, bottleneck: 'A&B' },
    { turn: 2, learnerMastery: 1.2, learnerMove: 'infer', register: 'coach', bottleneck: 'done' },
  ];
  const frame = { width: 100, height: 80, padding: { left: 10, top: 20 } };
  assert.equal(tutorStubFieldPolyline(rows, 'learnerMastery', frame), '10.0,80.0 110.0,20.0');
  assert.equal(
    tutorStubFieldTurnMarkers(rows, frame),
    '<circle cx="10.0" cy="118.0" r="2.8" fill="#475569"><title>1: ask &lt;why&gt; / no-register / A&amp;B</title></circle>\n' +
      '<circle cx="110.0" cy="118.0" r="2.8" fill="#475569"><title>2: infer / coach / done</title></circle>',
  );
});

test('field SVG serialization is byte-stable and keeps its accessibility and escaping contract', () => {
  const field = {
    schema: 'machinespirits.tutor-stub.lightweight-field.v1',
    turnCount: 3,
    rows: [FIRST, PREVIOUS, CURRENT],
    summary: {
      meanSpeed: 0.211,
      fieldDelta: {
        learnerMastery: 0.3,
        learnerRisk: -0.3,
        tutorAlignment: 0.15,
        jointMomentum: 0.3,
      },
      final: CURRENT,
    },
  };
  const svg = renderTutorStubLightweightFieldSvg(field, { title: 'Tutor & Learner <Field>' });
  assert.equal(
    createHash('sha256').update(svg).digest('hex'),
    'da2eebab7f9dbbb9bd38317df93d8b52ae834af43e048c3a52774d89f2851057',
  );
  assert.match(svg, /role="img" aria-labelledby="title desc"/u);
  assert.match(svg, /<title id="title">Tutor &amp; Learner &lt;Field&gt;<\/title>/u);
  assert.match(svg, /delta M \+0\.3 \| R -0\.3 \| A \+0\.15 \| P \+0\.3/u);
  assert.match(svg, /3: inference \/ evidence_coach \/ candidate_conclusion/u);
  assert.equal(svg.endsWith('</svg>\n'), true);
});

test('the debug-report runtime retains field I/O while the auto-eval renderer stays distinct', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubFieldPresentation.js'), 'utf8');
  const runtimeSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubDebugReportRuntime.js'), 'utf8');
  const autoEvalSource = fs.readFileSync(path.join(ROOT, 'scripts', 'run-tutor-stub-auto-eval.js'), 'utf8');

  assert.match(cliSource, /createTutorStubDebugReportRuntime/u);
  assert.match(runtimeSource, /from '\.\/tutorStubFieldPresentation\.js';/u);
  assert.doesNotMatch(
    cliSource,
    /function (?:fieldDelta|fieldBar|escapeXml|signedFieldDelta|summarizeFieldShift|describeFieldShift|fieldPolyline|fieldTurnMarkers|renderLightweightFieldSvg)\s*\(/u,
  );
  assert.doesNotMatch(cliSource, /function writeFieldVisualization\s*\(/u);
  assert.match(runtimeSource, /function writeFieldVisualization\s*\(/u);
  assert.match(runtimeSource, /function printFieldVisualization\s*\(/u);
  assert.match(autoEvalSource, /function renderLightweightFieldSvg\s*\(/u);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch)\s*\./u);
});
