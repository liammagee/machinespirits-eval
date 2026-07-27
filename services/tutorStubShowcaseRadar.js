/**
 * Radar (spider) plot for per-dimension rubric profiles, as a self-contained
 * inline SVG string.
 *
 * The showcase page is a single file opened from disk — often by someone who was
 * sent the file rather than the repo — so there is no chart library to load and
 * no network to load it from. The whole plot is geometry computed here and
 * emitted as SVG, styled with the house-style CSS variables the page already
 * carries so it follows the surrounding theme instead of pinning its own colours.
 *
 * What the shape can and cannot say:
 *
 *   A radar plot's enclosed AREA is an artefact of axis order, not a quantity.
 *   Reordering the dimensions changes the area without changing a single score,
 *   so the caller must never present "bigger shape = better tutor". What the plot
 *   is good for is the thing a column of numbers hides — which axes move together
 *   and which one moves alone — and on a rubric whose dimensions are largely
 *   redundant the near-circular result IS the finding.
 *
 * Each axis is normalised on its OWN declared range before plotting, because a
 * rubric may mix scales (v3.0 puts a 1-10 dimension beside a 1-5 one). Plotting
 * raw scores on a shared radius would draw the 1-5 dimension as permanently
 * weak.
 *
 * Pure: no fs, no config, no DOM. Returns a string, or `null` when the input
 * cannot honestly be drawn as a polygon.
 */

/**
 * Three axes is the minimum that encloses an area. Two produce a line whose
 * apparent length is pure axis-order artefact, so a two-dimension rubric gets
 * `null` and the caller says why in prose rather than drawing something the
 * reader would try to compare against the eight-dimension shape beside it.
 */
const MIN_AXES = 3;

/*
 * The viewBox is wider than it is tall on purpose. The plot itself is a circle,
 * but the axis labels are not distributed like one: the two on the vertical are
 * centred over their spoke and cost nothing horizontally, while every side label
 * runs outward from its vertex, and `adaptive_responsiveness` is long. A square
 * box either clips those or forces a radius small enough to waste the space the
 * vertical labels never needed. So the radius comes off the height and the extra
 * width is spent entirely on label room.
 */
const GEOMETRY = { width: 420, height: 340, padding: 66, levels: 4 };

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function round(value) {
  return Number(value.toFixed(2));
}

/**
 * Axis `index` of `count`, starting at twelve o'clock and running clockwise, at
 * `radius` from `centre` (an `{x, y}` pair, since the viewBox is not square).
 */
function point(centre, radius, index, count) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return [round(centre.x + radius * Math.cos(angle)), round(centre.y + radius * Math.sin(angle))];
}

/**
 * Score to a 0-1 radius fraction on the axis's own scale. A rubric's floor is 1,
 * not 0, so a minimum score is drawn at the centre rather than a fifth of the way
 * out — otherwise every profile looks better than it is.
 */
function fraction(value, axis) {
  const min = Number.isFinite(axis.min) ? axis.min : 1;
  const max = Number.isFinite(axis.max) ? axis.max : 5;
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Where an axis label sits, and how it must be anchored to stay inside the
 * viewBox. Labels on the left half hang to the left of their axis, labels on the
 * right hang to the right, and the two on the vertical get centred.
 */
function labelPlacement(centre, radius, index, count) {
  const [x, y] = point(centre, radius, index, count);
  const dx = x - centre.x;
  const anchor = Math.abs(dx) < 1 ? 'middle' : dx > 0 ? 'start' : 'end';
  const dy = y - centre.y;
  // Nudge the top and bottom labels clear of the vertex they belong to; the side
  // labels are already clear of it horizontally.
  const offset = Math.abs(dx) < 1 ? (dy < 0 ? -6 : 12) : 4;
  return { x, y: round(y + offset), anchor };
}

/**
 * Wrap a dimension key into short lines. Keys are snake_case and some are long
 * (`adaptive_responsiveness`), so they are split on their own underscores rather
 * than at a character count — a break inside a word would read as two dimensions.
 */
function labelLines(key) {
  const words = String(key).split('_');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length + 1 > 14) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * One series' polygon. Axes where this series has no value are skipped, so a
 * dimension the judge declared inapplicable leaves a corner cut rather than a
 * spike into the centre — plotting a missing verdict at the floor would show an
 * absent judgment as the worst possible one.
 */
function seriesPolygon(series, axes, centre, radius) {
  const vertices = [];
  let skipped = 0;
  axes.forEach((axis, index) => {
    const value = series.values[index];
    if (!Number.isFinite(value)) {
      skipped += 1;
      return;
    }
    vertices.push(point(centre, radius * fraction(value, axis), index, axes.length));
  });
  return { vertices, skipped };
}

/**
 * Render one radar.
 *
 *   axes:   [{ key, min, max }]           — the dimensions, in plot order
 *   series: [{ id, label, values, tone }] — values parallel to `axes`, null where absent
 *
 * `tone` is a house-style CSS variable name (without the `var()`), so the plot
 * inherits the page's palette and its dark mode along with it.
 */
export function renderShowcaseRadarSvg({ axes = [], series = [], title = '' } = {}) {
  if (axes.length < MIN_AXES) return null;
  const drawable = series.filter((entry) => entry.values.some((value) => Number.isFinite(value)));
  if (!drawable.length) return null;

  const { width, height, padding, levels } = GEOMETRY;
  const centre = { x: width / 2, y: height / 2 };
  const radius = height / 2 - padding;

  const rings = Array.from({ length: levels }, (_unused, level) => {
    const ringRadius = (radius * (level + 1)) / levels;
    const path = axes.map((_axis, index) => point(centre, ringRadius, index, axes.length).join(',')).join(' ');
    return `<polygon points="${path}" fill="none" stroke="var(--ms-border-subtle)" stroke-width="1" />`;
  }).join('');

  const spokes = axes
    .map((_axis, index) => {
      const [x, y] = point(centre, radius, index, axes.length);
      return `<line x1="${centre.x}" y1="${centre.y}" x2="${x}" y2="${y}" stroke="var(--ms-border-subtle)" stroke-width="1" />`;
    })
    .join('');

  const labels = axes
    .map((axis, index) => {
      const place = labelPlacement(centre, radius + 10, index, axes.length);
      // Each wrapped line is its own tspan re-anchored at the label's x, because
      // a tspan inherits the previous one's advance position rather than the
      // parent text element's — without the explicit x the second line would
      // start where the first ended.
      const lines = labelLines(axis.key)
        .map((line, lineIndex) => `<tspan x="${place.x}" dy="${lineIndex === 0 ? 0 : 11}">${escapeXml(line)}</tspan>`)
        .join('');
      const scale = Number.isFinite(axis.min) && Number.isFinite(axis.max) ? ` (${axis.min}–${axis.max})` : '';
      return `<text x="${place.x}" y="${place.y}" text-anchor="${place.anchor}" class="sc-radar-axis"><title>${escapeXml(axis.key + scale)}</title>${lines}</text>`;
    })
    .join('');

  const shapes = drawable
    .map((entry) => {
      const { vertices } = seriesPolygon(entry, axes, centre, radius);
      if (!vertices.length) return '';
      const tone = `var(--${entry.tone || 'ms-ink'})`;
      const points = vertices.map((vertex) => vertex.join(',')).join(' ');
      const dots = vertices
        .map((vertex) => `<circle cx="${vertex[0]}" cy="${vertex[1]}" r="2.6" fill="${tone}" />`)
        .join('');
      // Stroke, dots and a light fill: with two overlapping profiles the fill
      // alone is ambiguous about which shape owns an overlap, and the outline
      // survives being printed in greyscale.
      return `<g class="sc-radar-series"><polygon points="${points}" fill="${tone}" fill-opacity="0.13" stroke="${tone}" stroke-width="2" stroke-linejoin="round" />${dots}</g>`;
    })
    .join('');

  const heading = title ? `<title>${escapeXml(title)}</title>` : '';
  return `<svg class="sc-radar" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title || 'dimension profile')}" xmlns="http://www.w3.org/2000/svg">${heading}${rings}${spokes}${shapes}${labels}</svg>`;
}

/**
 * The reason a radar was not drawn, in the caller's words rather than a blank
 * space. An absent chart with no explanation reads as a rendering failure; this
 * says which of the two reasons applied.
 */
export function radarUnavailableReason(axisCount) {
  if (axisCount < MIN_AXES) {
    return (
      `A ${axisCount}-dimension rubric has no radar: ${axisCount} axes enclose no area, and the line they ` +
      'would draw is an artefact of which dimension was placed first.'
    );
  }
  return 'No scored turn carried a dimension breakdown, so there is nothing to plot.';
}

export const RADAR_MIN_AXES = MIN_AXES;
export const __testing = { point, fraction, labelLines, seriesPolygon, GEOMETRY };
