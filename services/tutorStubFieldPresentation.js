/**
 * Pure presentation helpers for the tutor-stub's lightweight interaction
 * field. Keep terminal output, filesystem writes, trace persistence, and
 * runtime state in the CLI; this module only converts field values to text or
 * SVG.
 */

function clampField01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function roundField(value) {
  return Number((Number(value) || 0).toFixed(3));
}

export function tutorStubFieldDelta(current, previous) {
  return roundField((current || 0) - (previous || 0));
}

export function tutorStubFieldBar(value, { width = 12 } = {}) {
  const filled = Math.round(clampField01(value) * width);
  return `${'#'.repeat(filled)}${'.'.repeat(Math.max(0, width - filled))}`;
}

export function tutorStubEscapeFieldXml(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

export function tutorStubSignedFieldDelta(current, previous) {
  if (!previous) return 'baseline';
  const delta = tutorStubFieldDelta(current, previous);
  return `${delta >= 0 ? '+' : ''}${delta}`;
}

export function summarizeTutorStubFieldShift(row, previous = null, first = null) {
  const previousBits = previous
    ? [
        `prev M ${tutorStubSignedFieldDelta(row.learnerMastery, previous.learnerMastery)}`,
        `R ${tutorStubSignedFieldDelta(row.learnerRisk, previous.learnerRisk)}`,
        `A ${tutorStubSignedFieldDelta(row.tutorAlignment, previous.tutorAlignment)}`,
        `P ${tutorStubSignedFieldDelta(row.jointMomentum, previous.jointMomentum)}`,
      ]
    : ['prev baseline'];
  const totalBits =
    first && first !== row
      ? [
          `total M ${tutorStubSignedFieldDelta(row.learnerMastery, first.learnerMastery)}`,
          `R ${tutorStubSignedFieldDelta(row.learnerRisk, first.learnerRisk)}`,
          `A ${tutorStubSignedFieldDelta(row.tutorAlignment, first.tutorAlignment)}`,
          `P ${tutorStubSignedFieldDelta(row.jointMomentum, first.jointMomentum)}`,
        ]
      : ['total baseline'];
  return `${previousBits.join(', ')}; ${totalBits.join(', ')}`;
}

export function describeTutorStubFieldShift(row, previous = null, summary = {}) {
  const pace = row.learnerAdvance?.accelerated
    ? `accelerating learner span (${row.learnerAdvance.supportedMoveCount} warranted moves); `
    : '';
  if (!previous) {
    return `${pace}baseline field frame; bottleneck ${row.bottleneck || summary.final?.bottleneck || 'unknown'}`;
  }
  const masteryDelta = tutorStubFieldDelta(row.learnerMastery, previous.learnerMastery);
  const riskDelta = tutorStubFieldDelta(row.learnerRisk, previous.learnerRisk);
  const alignmentDelta = tutorStubFieldDelta(row.tutorAlignment, previous.tutorAlignment);
  const momentumDelta = tutorStubFieldDelta(row.jointMomentum, previous.jointMomentum);
  const tags = [];
  if (masteryDelta >= 0.05) tags.push('learner mastery rising');
  if (riskDelta <= -0.05) tags.push('risk easing');
  if (riskDelta >= 0.05) tags.push('risk increasing');
  if (alignmentDelta >= 0.05) tags.push('tutor alignment improving');
  if (alignmentDelta <= -0.05) tags.push('tutor alignment weakening');
  if (momentumDelta >= 0.05) tags.push('joint momentum gaining');
  if (momentumDelta <= -0.05) tags.push('joint momentum slowing');
  if (!tags.length) tags.push('field mostly flat');
  const direction =
    masteryDelta > 0 && riskDelta <= 0
      ? 'productive'
      : masteryDelta > 0 && riskDelta > 0
        ? 'productive but strained'
        : masteryDelta <= 0 && riskDelta > 0
          ? 'stalled or risk-heavy'
          : 'stabilizing';
  return `${pace}${direction}: ${tags.join('; ')}; bottleneck ${row.bottleneck || summary.final?.bottleneck || 'unknown'}`;
}

export function tutorStubFieldPolyline(rows, key, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const y = padding.top + (1 - clampField01(row[key])) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function tutorStubFieldTurnMarkers(rows, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const label = tutorStubEscapeFieldXml(
        `${row.turn}: ${row.learnerMove} / ${row.register || 'no-register'} / ${row.bottleneck}`,
      );
      return `<circle cx="${x.toFixed(1)}" cy="${(padding.top + height + 18).toFixed(
        1,
      )}" r="2.8" fill="#475569"><title>${label}</title></circle>`;
    })
    .join('\n');
}

export function renderTutorStubLightweightFieldSvg(field, { title = 'Tutor Stub Interaction Field' } = {}) {
  const rows = field?.rows || [];
  const padding = { top: 78, right: 42, bottom: 78, left: 74 };
  const chartWidth = 780;
  const chartHeight = 280;
  const svgWidth = chartWidth + padding.left + padding.right;
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const final = field?.summary?.final || {};
  const delta = field?.summary?.fieldDelta || {};
  const series = [
    ['learnerMastery', 'mastery', '#2563eb'],
    ['learnerRisk', 'risk', '#dc2626'],
    ['tutorAlignment', 'alignment', '#059669'],
    ['jointMomentum', 'momentum', '#7c3aed'],
  ];
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((value) => {
      const y = padding.top + (1 - value) * chartHeight;
      return [
        `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(padding.left + chartWidth).toFixed(
          1,
        )}" y2="${y.toFixed(1)}" stroke="#e2e8f0" />`,
        `<text x="${padding.left - 12}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#64748b">${value.toFixed(
          2,
        )}</text>`,
      ].join('\n');
    })
    .join('\n');
  const lines = series
    .map(
      ([key, label, color]) =>
        `<polyline points="${tutorStubFieldPolyline(rows, key, {
          width: chartWidth,
          height: chartHeight,
          padding,
        })}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><title>${label}</title></polyline>`,
    )
    .join('\n');
  const legend = series
    .map(
      ([key, label, color], index) =>
        `<g transform="translate(${padding.left + index * 152}, ${svgHeight - 28})"><rect width="12" height="12" rx="2" fill="${color}" /><text x="18" y="11" font-size="12" fill="#334155">${label}: ${tutorStubEscapeFieldXml(
          final[key] ?? 'n/a',
        )}</text></g>`,
    )
    .join('\n');
  const deltaText = `delta M ${delta.learnerMastery >= 0 ? '+' : ''}${delta.learnerMastery ?? 'n/a'} | R ${
    delta.learnerRisk >= 0 ? '+' : ''
  }${delta.learnerRisk ?? 'n/a'} | A ${delta.tutorAlignment >= 0 ? '+' : ''}${
    delta.tutorAlignment ?? 'n/a'
  } | P ${delta.jointMomentum >= 0 ? '+' : ''}${delta.jointMomentum ?? 'n/a'}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-labelledby="title desc">
  <title id="title">${tutorStubEscapeFieldXml(title)}</title>
  <desc id="desc">Lightweight tutor-stub field visualization across ${rows.length} completed turn(s).</desc>
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="${padding.left}" y="32" font-size="22" font-weight="700" fill="#0f172a">${tutorStubEscapeFieldXml(title)}</text>
  <text x="${padding.left}" y="55" font-size="13" fill="#475569">turns ${field.turnCount}; mean speed ${tutorStubEscapeFieldXml(
    field.summary?.meanSpeed ?? 'n/a',
  )}; ${tutorStubEscapeFieldXml(deltaText)}; bottleneck ${tutorStubEscapeFieldXml(final.bottleneck || 'unknown')}</text>
  <rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" stroke="#cbd5e1" />
  ${gridLines}
  ${lines}
  ${tutorStubFieldTurnMarkers(rows, { width: chartWidth, height: chartHeight, padding })}
  <text x="${padding.left}" y="${svgHeight - 47}" font-size="11" fill="#64748b">Each marker title lists turn / learner move / register / bottleneck.</text>
  ${legend}
</svg>
`;
}
