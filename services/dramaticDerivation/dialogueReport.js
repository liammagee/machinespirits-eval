import {
  buildDynamicLearnerField,
  buildDynamicLearnerFieldFromResult,
  LEARNER_FIELD_DIMENSIONS,
} from './learnerField.js';
import { buildPedagogicalInteractionField } from './interactionField.js';

export const DIALOGUE_REPORT_SCHEMA = 'machinespirits.derivation.dialogue-report.v1';

const FIELD_LINE_DIMENSIONS = [
  ['mastery', '#227c64'],
  ['evidenceGrounding', '#2f6db3'],
  ['productiveConfusion', '#b26b1f'],
  ['misconceptionRisk', '#b43f44'],
  ['uncertainty', '#6a5aa8'],
];

const INTERACTION_LINE_DIMENSIONS = [
  ['couplingStrength', '#227c64'],
  ['pedagogicalAlignment', '#2f6db3'],
  ['productiveTension', '#b26b1f'],
  ['interactionMomentum', '#6a5aa8'],
  ['trajectoryRisk', '#b43f44'],
];

const ATTRACTOR_COLORS = {
  stable_mastery: '#3f8c67',
  productive_confusion: '#d39a34',
  misconception_attractor: '#c24b4b',
  plateau: '#8c939d',
  latent_unreleased: '#d9dee5',
  open_learning: '#5d91c5',
};

function clamp01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.min(1, Math.max(0, Number(value)));
}

function round3(value) {
  return Number((Number(value) || 0).toFixed(3));
}

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapeMarkdown(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}

function buildDynamicField(world, result = {}) {
  if (result.learnerDag) return buildDynamicLearnerField(world, result.learnerDag);
  return buildDynamicLearnerFieldFromResult(world, result);
}

function releaseSummary(result = {}) {
  return (result.ledger || []).map((row) => ({
    turn: row.turn,
    premiseId: row.premiseId,
    via: row.via || null,
  }));
}

function eventSummary(result = {}) {
  return (result.events || []).map((event) => ({
    turn: event.turn ?? null,
    type: event.type || 'event',
    detail: event.detail || '',
  }));
}

function fieldTurnRows(field = {}) {
  return (field.turns || []).map((turn) => ({
    turn: turn.turn,
    summary: turn.summary,
    recommendedActions: turn.recommendedActions || [],
    attractorCounts: turn.summary?.attractorCounts || {},
    phaseCounts: turn.summary?.phaseCounts || {},
  }));
}

export function buildDialogueReport(result = {}, world, { label = null, diagnosis = null } = {}) {
  const dynamicLearnerField = buildDynamicField(world, result);
  const pedagogicalInteractionField = buildPedagogicalInteractionField(world, result, {
    learnerField: dynamicLearnerField,
  });
  const finalField = dynamicLearnerField?.final || null;
  const finalSummary = finalField?.summary || null;
  const interactionFinal = pedagogicalInteractionField?.final || null;
  return {
    schema: DIALOGUE_REPORT_SCHEMA,
    label,
    worldId: world?.id || result.worldId || null,
    title: world?.title || null,
    dialogue: {
      verdict: result.verdict || diagnosis?.verdict || null,
      turnsPlayed: result.turnsPlayed ?? diagnosis?.turnsPlayed ?? null,
      turnCap: world?.turnCap ?? diagnosis?.turnCap ?? null,
      firstForcedTurn: result.firstForcedTurn ?? diagnosis?.firstForcedTurn ?? null,
      assertedGroundedTurn: result.assertedGroundedTurn ?? diagnosis?.assertedGroundedTurn ?? null,
      forcedToAssertedGap: diagnosis?.forcedToAssertedGap ?? null,
      events: eventSummary(result),
      releases: releaseSummary(result),
      dialogueDiscipline: diagnosis?.dialogueDiscipline || null,
    },
    learnerDagAssessment: result.learnerDag?.assessment || null,
    dynamicLearnerField,
    pedagogicalInteractionField,
    fieldTurnRows: fieldTurnRows(dynamicLearnerField),
    summary: {
      finalTurn: finalField?.turn ?? null,
      fieldDelta: dynamicLearnerField?.trajectory?.fieldDelta || {},
      meanSpeed: dynamicLearnerField?.trajectory?.meanSpeed ?? 0,
      finalAttractorCounts: dynamicLearnerField?.trajectory?.finalAttractorCounts || {},
      finalRecommendedActions: dynamicLearnerField?.trajectory?.finalRecommendedActions || [],
      finalDimensions: finalSummary?.dimensions || {},
      topologyNodeCount: finalSummary?.topologyNodeCount || 0,
      evidenceNodeCount: finalSummary?.evidenceNodeCount || 0,
      interactionFinalDimensions: interactionFinal?.joint?.dimensions || {},
      interactionFinalAttractor: interactionFinal?.joint?.attractor || null,
      finalScriptStage: pedagogicalInteractionField?.trajectory?.finalScriptStage || null,
    },
  };
}

function xScale(turns, left, width) {
  const values = turns.map((turn) => Number(turn.turn)).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = Math.max(1, max - min);
  return (turn) => left + ((Number(turn) - min) / span) * width;
}

function linePath(turns, dimension, x, y) {
  const points = turns.map((turn) => [x(turn.turn), y(turn.summary?.dimensions?.[dimension])]);
  if (!points.length) return '';
  return points.map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
}

function attractorColor(attractor) {
  return ATTRACTOR_COLORS[attractor] || ATTRACTOR_COLORS.open_learning;
}

export function renderDynamicLearnerFieldSvg(reportOrField) {
  const field = reportOrField?.dynamicLearnerField || reportOrField;
  const interactionField = reportOrField?.pedagogicalInteractionField || null;
  const turns = field?.turns || [];
  const interactionTurns = interactionField?.turns || [];
  const topologyNodes = field?.topology?.nodes || [];
  const rowH = 28;
  const W = 1100;
  const left = 180;
  const right = 42;
  const plotTop = 48;
  const plotH = 190;
  const coupledRows = interactionField
    ? [
        ['Learner field', (turn) => average([turn.learner?.dimensions?.mastery, turn.learner?.dimensions?.engagement])],
        [
          'Tutor field',
          (turn) => average([turn.tutor?.dimensions?.diagnosticConfidence, turn.tutor?.dimensions?.rapport]),
        ],
        [
          'Discourse field',
          (turn) =>
            average([turn.discourse?.dimensions?.sharedVocabulary, turn.discourse?.dimensions?.interactionRhythm]),
        ],
        [
          'Joint field',
          (turn) => average([turn.joint?.dimensions?.couplingStrength, turn.joint?.dimensions?.interactionMomentum]),
        ],
      ]
    : [];
  const coupledTop = 308;
  const coupledH = coupledRows.length ? coupledRows.length * rowH : 0;
  const heatTop = coupledTop + coupledH + (coupledRows.length ? 54 : 0);
  const heatH = Math.max(rowH, topologyNodes.length * rowH);
  const evidenceTop = heatTop + heatH + 34;
  const H = evidenceTop + 92;
  const plotW = W - left - right;
  const x = xScale(turns, left, plotW);
  const ix = xScale(interactionTurns.length ? interactionTurns : turns, left, plotW);
  const y = (value) => plotTop + (1 - clamp01(value)) * plotH;
  const svg = [];
  const lineTurns = interactionTurns.length
    ? interactionTurns.map((turn) => ({ turn: turn.turn, summary: { dimensions: turn.joint?.dimensions || {} } }))
    : turns;
  const lineDefinitions = interactionTurns.length ? INTERACTION_LINE_DIMENSIONS : FIELD_LINE_DIMENSIONS;

  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Coupled pedagogical interaction field movement across the dialogue">`,
    '<style>',
    'text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#243040}',
    '.title{font-size:21px;font-weight:700}.sub{font-size:12px;fill:#647084}.axis{stroke:#c9d1dc;stroke-width:1}.grid{stroke:#e5e9ef;stroke-width:1}.line{fill:none;stroke-width:3}.legend{font-size:12px}.label{font-size:12px}.small{font-size:11px;fill:#647084}.cell{stroke:#ffffff;stroke-width:1}.signal{stroke:#ffffff;stroke-width:1.5}',
    '</style>',
    `<rect width="${W}" height="${H}" fill="#fbfcfe"/>`,
    `<text x="24" y="30" class="title">Coupled pedagogical interaction field movement</text>`,
    `<text x="24" y="50" class="sub">Learner, tutor, discourse, and joint fields evolving over the shared pedagogical process.</text>`,
  );

  for (const pct of [0, 0.25, 0.5, 0.75, 1]) {
    const gy = y(pct);
    svg.push(
      `<line x1="${left}" y1="${gy.toFixed(1)}" x2="${(W - right).toFixed(1)}" y2="${gy.toFixed(1)}" class="grid"/>`,
      `<text x="${left - 10}" y="${(gy + 4).toFixed(1)}" text-anchor="end" class="small">${pct.toFixed(2)}</text>`,
    );
  }
  svg.push(`<line x1="${left}" y1="${plotTop}" x2="${left}" y2="${plotTop + plotH}" class="axis"/>`);
  svg.push(`<line x1="${left}" y1="${plotTop + plotH}" x2="${W - right}" y2="${plotTop + plotH}" class="axis"/>`);

  for (const turn of lineTurns) {
    const tx = interactionTurns.length ? ix(turn.turn) : x(turn.turn);
    svg.push(
      `<line x1="${tx.toFixed(1)}" y1="${plotTop + plotH}" x2="${tx.toFixed(1)}" y2="${plotTop + plotH + 6}" class="axis"/>`,
      `<text x="${tx.toFixed(1)}" y="${plotTop + plotH + 21}" text-anchor="middle" class="small">t${escapeXml(turn.turn)}</text>`,
    );
  }

  lineDefinitions.forEach(([dimension, color], index) => {
    const d = linePath(lineTurns, dimension, interactionTurns.length ? ix : x, y);
    if (d) svg.push(`<path d="${d}" class="line" stroke="${color}"/>`);
    const lx = left + index * 172;
    svg.push(
      `<rect x="${lx}" y="${plotTop + plotH + 38}" width="12" height="12" fill="${color}" rx="2"/>`,
      `<text x="${lx + 18}" y="${plotTop + plotH + 49}" class="legend">${escapeXml(dimension)}</text>`,
    );
  });

  if (coupledRows.length) {
    svg.push(`<text x="24" y="${coupledTop - 12}" class="label">Synchronized fields</text>`);
    const fieldCellW = interactionTurns.length ? plotW / interactionTurns.length : plotW;
    coupledRows.forEach(([label, valueForTurn], rowIndex) => {
      const cy = coupledTop + rowIndex * rowH + rowH / 2;
      svg.push(
        `<text x="${left - 12}" y="${(cy + 4).toFixed(1)}" text-anchor="end" class="label">${escapeXml(label)}</text>`,
      );
      interactionTurns.forEach((turn, colIndex) => {
        const value = clamp01(valueForTurn(turn));
        const cellX = left + colIndex * fieldCellW;
        const fill = rowIndex === 0 ? '#227c64' : rowIndex === 1 ? '#6a5aa8' : rowIndex === 2 ? '#2f6db3' : '#b26b1f';
        const title = [
          `turn ${turn.turn}`,
          label,
          `value ${round3(value)}`,
          `script ${turn.script?.stage || 'unknown'}`,
          `joint ${turn.joint?.attractor || 'unknown'}`,
        ].join(' | ');
        svg.push(
          `<rect x="${cellX.toFixed(1)}" y="${(coupledTop + rowIndex * rowH).toFixed(1)}" width="${Math.max(1, fieldCellW - 1).toFixed(1)}" height="${rowH - 1}" class="cell" fill="${fill}" opacity="${(0.2 + value * 0.7).toFixed(2)}"><title>${escapeXml(title)}</title></rect>`,
        );
      });
    });
  }

  svg.push(`<text x="24" y="${heatTop - 12}" class="label">Premise topology field</text>`);
  const cellW = turns.length ? plotW / turns.length : plotW;
  topologyNodes.forEach((node, rowIndex) => {
    const cy = heatTop + rowIndex * rowH + rowH / 2;
    svg.push(
      `<text x="${left - 12}" y="${(cy + 4).toFixed(1)}" text-anchor="end" class="label"><title>${escapeXml(node.factText)}</title>${escapeXml(node.premiseId || node.id)}</text>`,
    );
    turns.forEach((turn, colIndex) => {
      const fieldNode = (turn.nodes || []).find((candidate) => candidate.id === node.id);
      const cellX = left + colIndex * cellW;
      const mastery = clamp01(fieldNode?.dimensions?.mastery);
      const fill = attractorColor(fieldNode?.attractor);
      const opacity = 0.22 + mastery * 0.68;
      const speed = clamp01(fieldNode?.dynamics?.speed);
      const title = [
        `turn ${turn.turn}`,
        node.premiseId || node.id,
        fieldNode?.attractor || 'unknown',
        `mastery ${round3(mastery)}`,
        `speed ${round3(speed)}`,
        node.factText,
      ].join(' | ');
      svg.push(
        `<rect x="${cellX.toFixed(1)}" y="${(heatTop + rowIndex * rowH).toFixed(1)}" width="${Math.max(1, cellW - 1).toFixed(1)}" height="${rowH - 1}" class="cell" fill="${fill}" opacity="${opacity.toFixed(2)}"><title>${escapeXml(title)}</title></rect>`,
      );
      if (speed > 0.02) {
        svg.push(
          `<circle cx="${(cellX + cellW / 2).toFixed(1)}" cy="${cy.toFixed(1)}" r="${(2 + speed * 8).toFixed(1)}" fill="#1f2937" opacity="0.38"><title>${escapeXml(`movement speed ${round3(speed)}`)}</title></circle>`,
        );
      }
    });
  });

  const evidenceTurns = turns.filter((turn) => (turn.evidenceNodes || []).length);
  svg.push(`<text x="24" y="${evidenceTop - 12}" class="label">Learner-evidence signals</text>`);
  svg.push(
    `<line x1="${left}" y1="${evidenceTop}" x2="${W - right}" y2="${evidenceTop}" class="axis"/>`,
    `<text x="${left - 12}" y="${evidenceTop + 4}" text-anchor="end" class="label">signals</text>`,
  );
  for (const turn of evidenceTurns) {
    const tx = x(turn.turn);
    for (const [index, node] of (turn.evidenceNodes || []).entries()) {
      const color = attractorColor(node.attractor);
      const cy = evidenceTop - 8 - index * 16;
      svg.push(
        `<circle cx="${tx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" class="signal" fill="${color}"><title>${escapeXml(`turn ${turn.turn}: ${node.attractor} | ${node.factText}`)}</title></circle>`,
      );
    }
  }

  const legendY = H - 44;
  Object.entries(ATTRACTOR_COLORS).forEach(([name, color], index) => {
    const lx = 24 + (index % 3) * 260;
    const ly = legendY + Math.floor(index / 3) * 20;
    svg.push(
      `<rect x="${lx}" y="${ly - 10}" width="12" height="12" fill="${color}" rx="2"/>`,
      `<text x="${lx + 18}" y="${ly}" class="small">${escapeXml(name)}</text>`,
    );
  });

  if (!turns.length) {
    svg.push(
      `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="label">No learner-field turns available</text>`,
    );
  }

  svg.push('</svg>');
  return `${svg.join('\n')}\n`;
}

function formatDimension(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(3) : 'n/a';
}

function actionText(actions = []) {
  return actions.map((row) => row.action).join(', ') || 'none';
}

function attractorText(counts = {}) {
  const parts = Object.entries(counts).filter(([, count]) => count);
  return parts.length ? parts.map(([key, count]) => `${key} x${count}`).join(', ') : 'none';
}

export function renderDialogueReportMarkdown(report, { visualizationPath = 'dynamic-field.svg' } = {}) {
  const lines = [];
  const dialogue = report.dialogue || {};
  const summary = report.summary || {};
  const dims = summary.finalDimensions || {};
  lines.push(`# Dialogue Report - ${report.label || report.worldId || 'derivation run'}`);
  lines.push('');
  if (report.title) lines.push(`World: **${escapeMarkdown(report.title)}**`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Verdict: \`${escapeMarkdown(dialogue.verdict || 'unknown')}\``);
  lines.push(`- Turns: ${dialogue.turnsPlayed ?? 'n/a'} / ${dialogue.turnCap ?? 'n/a'}`);
  lines.push(
    `- Recognition: forced turn ${dialogue.firstForcedTurn ?? 'n/a'}, asserted grounded turn ${dialogue.assertedGroundedTurn ?? 'n/a'}`,
  );
  lines.push(`- Releases: ${(dialogue.releases || []).length}`);
  lines.push(`- Events: ${(dialogue.events || []).length}`);
  lines.push('');
  lines.push('## Coupled Field Visualization');
  lines.push('');
  lines.push(`![Coupled pedagogical interaction field movement](${visualizationPath})`);
  lines.push('');
  lines.push('## Dynamic Learner Field');
  lines.push('');
  lines.push(`- Final turn: ${summary.finalTurn ?? 'n/a'}`);
  lines.push(`- Mean field speed: ${formatDimension(summary.meanSpeed)}`);
  lines.push(`- Topology nodes: ${summary.topologyNodeCount ?? 0}`);
  lines.push(`- Evidence signal nodes: ${summary.evidenceNodeCount ?? 0}`);
  lines.push(`- Final attractors: ${escapeMarkdown(attractorText(summary.finalAttractorCounts))}`);
  lines.push(`- Recommended actions: ${escapeMarkdown(actionText(summary.finalRecommendedActions))}`);
  lines.push('');
  lines.push('## Coupled Pedagogical Interaction Field');
  lines.push('');
  lines.push(`- Final script stage: \`${escapeMarkdown(summary.finalScriptStage || 'n/a')}\``);
  lines.push(`- Final joint attractor: \`${escapeMarkdown(summary.interactionFinalAttractor || 'n/a')}\``);
  lines.push('');
  lines.push('| joint dimension | final |');
  lines.push('| --- | ---: |');
  for (const [dimension, value] of Object.entries(summary.interactionFinalDimensions || {})) {
    lines.push(`| ${escapeMarkdown(dimension)} | ${formatDimension(value)} |`);
  }
  lines.push('');
  lines.push('| dimension | final | delta |');
  lines.push('| --- | ---: | ---: |');
  for (const dimension of LEARNER_FIELD_DIMENSIONS) {
    lines.push(
      `| ${escapeMarkdown(dimension)} | ${formatDimension(dims[dimension])} | ${formatDimension(summary.fieldDelta?.[dimension])} |`,
    );
  }
  lines.push('');
  lines.push('## Turn Trace');
  lines.push('');
  lines.push('| turn | mastery | grounding | uncertainty | speed | attractors | actions |');
  lines.push('| ---: | ---: | ---: | ---: | ---: | --- | --- |');
  for (const row of report.fieldTurnRows || []) {
    const rowDims = row.summary?.dimensions || {};
    lines.push(
      `| ${row.turn ?? 'n/a'} | ${formatDimension(rowDims.mastery)} | ${formatDimension(rowDims.evidenceGrounding)} | ${formatDimension(rowDims.uncertainty)} | ${formatDimension(row.summary?.meanSpeed)} | ${escapeMarkdown(attractorText(row.attractorCounts))} | ${escapeMarkdown(actionText(row.recommendedActions))} |`,
    );
  }
  const dag = report.learnerDagAssessment;
  if (dag) {
    lines.push('');
    lines.push('## Learner DAG Assessment');
    lines.push('');
    lines.push(`- Status: \`${escapeMarkdown(dag.status || 'unknown')}\``);
    lines.push(`- Best path coverage: ${formatDimension(dag.bestPathCoverage)}`);
    lines.push(`- Bottleneck: \`${escapeMarkdown(dag.bottleneck || 'n/a')}\``);
    lines.push(`- Complete paths: ${escapeMarkdown((dag.completePathIds || []).join(', ') || 'none')}`);
  }
  if ((dialogue.releases || []).length) {
    lines.push('');
    lines.push('## Releases');
    lines.push('');
    for (const release of dialogue.releases) {
      lines.push(
        `- t${release.turn}: ${escapeMarkdown(release.premiseId)} via ${escapeMarkdown(release.via || 'unknown')}`,
      );
    }
  }
  if ((dialogue.events || []).length) {
    lines.push('');
    lines.push('## Events');
    lines.push('');
    for (const event of dialogue.events) {
      lines.push(
        `- t${event.turn ?? 'n/a'}: \`${escapeMarkdown(event.type)}\`${event.detail ? ` - ${escapeMarkdown(event.detail)}` : ''}`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function renderDialogueReportArtifacts(report) {
  return {
    'dialogue-report.json': `${JSON.stringify(report, null, 2)}\n`,
    'dialogue-report.md': renderDialogueReportMarkdown(report),
    'dynamic-field.svg': renderDynamicLearnerFieldSvg(report),
  };
}
