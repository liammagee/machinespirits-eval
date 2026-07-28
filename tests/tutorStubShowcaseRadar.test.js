import assert from 'node:assert/strict';
import test from 'node:test';

import {
  radarUnavailableReason,
  renderShowcaseRadarSvg,
  RADAR_MIN_AXES,
  __testing,
} from '../services/tutorStubShowcaseRadar.js';

const { point, fraction, labelLines, seriesPolygon, GEOMETRY } = __testing;

const AXES = [
  { key: 'perception_quality', min: 1, max: 5 },
  { key: 'pedagogical_craft', min: 1, max: 5 },
  { key: 'adaptive_responsiveness', min: 1, max: 5 },
  { key: 'content_accuracy', min: 1, max: 5 },
];

function series(values, overrides = {}) {
  return { id: 'bare', label: 'bare', baseline: true, turns: 4, tone: 'ms-ink', values, ...overrides };
}

test('axis 0 sits at twelve o_clock and the rest run clockwise', () => {
  const centre = { x: 100, y: 100 };
  assert.deepEqual(point(centre, 50, 0, 4), [100, 50]);
  assert.deepEqual(point(centre, 50, 1, 4), [150, 100]);
  assert.deepEqual(point(centre, 50, 2, 4), [100, 150]);
  assert.deepEqual(point(centre, 50, 3, 4), [50, 100]);
});

test('the rubric floor plots at the centre, not a fifth of the way out', () => {
  // A 1-5 rubric has no 0. Treating the scale as 0-5 would draw the worst
  // possible score as a fifth of a good one, and every profile would look
  // better than it is.
  assert.equal(fraction(1, { min: 1, max: 5 }), 0);
  assert.equal(fraction(3, { min: 1, max: 5 }), 0.5);
  assert.equal(fraction(5, { min: 1, max: 5 }), 1);
});

test('each axis normalises on its own range, so mixed scales are comparable', () => {
  assert.equal(fraction(5.5, { min: 1, max: 10 }), 0.5);
  assert.equal(fraction(3, { min: 1, max: 5 }), 0.5);
});

test('fraction clamps out-of-range values instead of plotting outside the ring', () => {
  assert.equal(fraction(0, { min: 1, max: 5 }), 0);
  assert.equal(fraction(9, { min: 1, max: 5 }), 1);
  assert.equal(fraction(3, { min: 4, max: 4 }), 0);
});

test('labels wrap on their own underscores, never mid-word', () => {
  assert.deepEqual(labelLines('perception_quality'), ['perception', 'quality']);
  assert.deepEqual(labelLines('adaptive_responsiveness'), ['adaptive', 'responsiveness']);
  assert.deepEqual(labelLines('safety'), ['safety']);
});

test('an unscored axis cuts a corner rather than spiking to the centre', () => {
  // Plotting a missing verdict at the floor would render an absent judgment as
  // the worst possible one, which is a different claim entirely.
  const { vertices, skipped } = seriesPolygon(series([3, null, 3, 3]), AXES, { x: 170, y: 170 }, 100);
  assert.equal(vertices.length, 3);
  assert.equal(skipped, 1);
});

test('renderShowcaseRadarSvg refuses to draw below the minimum axis count', () => {
  assert.equal(RADAR_MIN_AXES, 3);
  const svg = renderShowcaseRadarSvg({
    axes: AXES.slice(0, 2),
    series: [series([3, 4])],
    title: 'two axes',
  });
  assert.equal(svg, null);
});

test('renderShowcaseRadarSvg returns null when no series has a single value', () => {
  const svg = renderShowcaseRadarSvg({ axes: AXES, series: [series([null, null, null, null])] });
  assert.equal(svg, null);
});

test('renderShowcaseRadarSvg draws one polygon group per series, in its own tone', () => {
  const svg = renderShowcaseRadarSvg({
    axes: AXES,
    series: [
      series([3, 3, 3, 3]),
      series([4, 4, 4, 4], { id: 'instrumented', label: 'instrumented', tone: 'ms-ochre' }),
    ],
    title: 'v2.2 dimension profile by arm',
  });
  assert.equal((svg.match(/class="sc-radar-series"/g) || []).length, 2);
  assert.ok(svg.includes('var(--ms-ink)'));
  assert.ok(svg.includes('var(--ms-ochre)'));
});

test('the svg carries no pinned colours, so it follows the page theme', () => {
  const svg = renderShowcaseRadarSvg({ axes: AXES, series: [series([3, 3, 3, 3])] });
  // Any hex or rgb() literal would survive a theme switch and stop matching the
  // page around it; every stroke and fill has to come from a house-style var.
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(svg), false);
  assert.equal(/rgba?\(/i.test(svg), false);
});

test('every label stays inside the viewBox', () => {
  // The reason the viewBox is wider than it is tall. A clipped axis name reads
  // as a different dimension than the one that was scored.
  const svg = renderShowcaseRadarSvg({ axes: AXES, series: [series([3, 3, 3, 3])] });
  const xs = [...svg.matchAll(/<tspan x="([-\d.]+)"/g)].map((match) => Number(match[1]));
  assert.ok(xs.length > 0);
  for (const x of xs) {
    assert.ok(x > 0 && x < GEOMETRY.width, `label anchored at ${x} is outside 0..${GEOMETRY.width}`);
  }
  const ys = [...svg.matchAll(/<text x="[-\d.]+" y="([-\d.]+)"/g)].map((match) => Number(match[1]));
  for (const y of ys) {
    assert.ok(y > 0 && y < GEOMETRY.height, `label baseline at ${y} is outside 0..${GEOMETRY.height}`);
  }
});

test('a wrapped label re-anchors every line at the same x', () => {
  // A tspan inherits the previous one's advance position, so without an explicit
  // x the second line would start where the first ended.
  const svg = renderShowcaseRadarSvg({ axes: AXES, series: [series([3, 3, 3, 3])] });
  const perception = svg.match(/<tspan x="([-\d.]+)"[^>]*>perception<\/tspan><tspan x="([-\d.]+)"/);
  assert.ok(perception, 'expected perception_quality to wrap onto two tspans');
  assert.equal(perception[1], perception[2]);
});

test('axis titles escape and carry the range a reader needs to read the shape', () => {
  const svg = renderShowcaseRadarSvg({
    axes: [...AXES.slice(0, 3), { key: 'quality<&>', min: 1, max: 10 }],
    series: [series([3, 3, 3, 8])],
  });
  assert.ok(svg.includes('quality&lt;&amp;&gt; (1–10)'));
  assert.equal(svg.includes('<&>'), false);
});

test('radarUnavailableReason names the reason instead of leaving a blank', () => {
  assert.match(radarUnavailableReason(2), /2 axes enclose no area/);
  assert.match(radarUnavailableReason(8), /nothing to plot/);
});
