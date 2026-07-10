#!/usr/bin/env node
/**
 * Fixed-horizon and trajectory-AUC analysis for tutor-stub auto-eval runs.
 *
 * Reads auto-eval summary JSONs (per-turn substrate: trainingExamples +
 * animatedViz frames), and reports policy x learner-profile cells on
 * outcome channels that do NOT allow until-grounded catch-up:
 *   - progress at fixed learner turns (default 8, 12, 16): coverage,
 *     mastery, risk, grounded-by-turn
 *   - normalized trapezoid AUC over the horizon for coverage, mastery,
 *     and safety (1 - risk)
 *   - grounded turn and final closure for reference
 *
 * Interaction view: per-profile policy rankings at each horizon with
 * dialogue-level dispersion (mean +/- sd over runs), and bland deltas.
 * All metrics are outcome channels; register diversity never enters.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    horizons: { type: 'string', default: '8,12,16' },
    'auc-horizon': { type: 'string', default: '16' },
    baseline: { type: 'string', default: 'bland' },
    out: { type: 'string', default: '' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  console.log(`Usage:
  node scripts/analyze-tutor-stub-trajectories.js <summary.json|dir>... [options]

Options:
  --horizons <csv>      fixed learner-turn horizons (default: 8,12,16)
  --auc-horizon <n>     AUC horizon in learner turns (default: 16)
  --baseline <policy>   per-profile delta baseline (default: bland)
  --out <path>          write report (md, or json with --json)
  --json                emit JSON instead of markdown
`);
}

function round(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? round(finite.reduce((sum, value) => sum + value, 0) / finite.length) : null;
}

function stddev(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < 2) return null;
  const avg = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (finite.length - 1);
  return round(Math.sqrt(variance));
}

function walkSummaries(entries) {
  const files = [];
  for (const entry of entries) {
    const full = path.resolve(entry);
    const stat = fs.statSync(full);
    if (stat.isFile()) {
      files.push(full);
      continue;
    }
    const stack = [full];
    while (stack.length) {
      const dir = stack.pop();
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const itemPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          if (!['logs', 'traces'].includes(item.name) && !item.name.endsWith('-field-svg')) stack.push(itemPath);
        } else if (/^auto-eval-.*\.json$/u.test(item.name)) {
          files.push(itemPath);
        }
      }
    }
  }
  return [...new Set(files)].sort();
}

// Per-turn series for one dialogue row. Turn indexes are learner turns as
// recorded by the runner (trainingExamples[].turn / animatedViz frames[].turn).
function rowSeries(row) {
  const byTurn = new Map();
  for (const example of row.trainingExamples?.examples || []) {
    const turn = Number(example.turn);
    if (!Number.isFinite(turn)) continue;
    const field = example.stateBeforeAction?.field || {};
    byTurn.set(turn, {
      turn,
      mastery: Number(field.learnerMastery),
      risk: Number(field.learnerRisk),
      coverage: Number(field.coverage),
    });
  }
  for (const frame of row.animatedViz?.frames || []) {
    const turn = Number(frame.turn);
    if (!Number.isFinite(turn)) continue;
    const entry = byTurn.get(turn) || { turn };
    const dag = frame.state?.dag || {};
    if (Number.isFinite(Number(dag.bestPathCoverage))) entry.coverage = Number(dag.bestPathCoverage);
    entry.missing = Number.isFinite(Number(dag.missingPremiseCount)) ? Number(dag.missingPremiseCount) : entry.missing;
    entry.asserted = Boolean(dag.assertedSecret) && Boolean(dag.finalSecretEntailed);
    byTurn.set(turn, entry);
  }
  return [...byTurn.values()].sort((a, b) => a.turn - b.turn);
}

function groundedTurn(series, row) {
  for (const entry of series) {
    if (entry.asserted) return entry.turn;
  }
  return row.groundedClosure ? Number(row.turnCount) || null : null;
}

// Value at horizon t: last observation at or before t (dialogues that ended
// early carry their final state forward — an ended-grounded dialogue holds
// its closing coverage, which is the honest fixed-horizon reading).
function valueAt(series, key, turn) {
  let value = null;
  for (const entry of series) {
    if (entry.turn > turn) break;
    if (Number.isFinite(entry[key])) value = entry[key];
  }
  return value;
}

function aucTo(series, key, horizon, { invert = false } = {}) {
  const points = series
    .filter((entry) => entry.turn <= horizon && Number.isFinite(entry[key]))
    .map((entry) => ({ turn: entry.turn, value: invert ? 1 - entry[key] : entry[key] }));
  if (points.length < 2) return null;
  let area = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dt = points[i].turn - points[i - 1].turn;
    area += ((points[i].value + points[i - 1].value) / 2) * dt;
  }
  // Carry the last value flat to the horizon so early-ending dialogues are
  // not penalized for having fewer samples.
  const last = points[points.length - 1];
  if (last.turn < horizon) area += last.value * (horizon - last.turn);
  const span = horizon - points[0].turn;
  return span > 0 ? round(area / span) : null;
}

function analyzeRow(row, profile, horizons, aucHorizon) {
  const series = rowSeries(row);
  if (!series.length) return null;
  const grounded = groundedTurn(series, row);
  const result = {
    profile,
    policy: row.policy,
    runIndex: row.runIndex,
    turnCount: Number(row.turnCount) || null,
    groundedClosure: Boolean(row.groundedClosure),
    groundedTurn: grounded,
    finalCoverage: round(row.bestPathCoverage),
    leakCount: Number(row.leakCount) || 0,
    auc: {
      coverage: aucTo(series, 'coverage', aucHorizon),
      mastery: aucTo(series, 'mastery', aucHorizon),
      safety: aucTo(series, 'risk', aucHorizon, { invert: true }),
    },
    at: {},
  };
  for (const horizon of horizons) {
    result.at[horizon] = {
      coverage: round(valueAt(series, 'coverage', horizon)),
      mastery: round(valueAt(series, 'mastery', horizon)),
      risk: round(valueAt(series, 'risk', horizon)),
      groundedBy: grounded !== null && grounded <= horizon,
    };
  }
  return result;
}

function cellKey(profile, policy) {
  return `${profile}\0${policy}`;
}

function summarizeCells(rows, horizons) {
  const byCell = new Map();
  for (const row of rows) {
    const key = cellKey(row.profile, row.policy);
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(row);
  }
  const cells = [];
  for (const [key, cellRows] of byCell.entries()) {
    const [profile, policy] = key.split('\0');
    const cell = {
      profile,
      policy,
      n: cellRows.length,
      groundedRate: mean(cellRows.map((row) => (row.groundedClosure ? 1 : 0))),
      meanGroundedTurn: mean(cellRows.filter((row) => row.groundedTurn !== null).map((row) => row.groundedTurn)),
      auc: {
        coverage: mean(cellRows.map((row) => row.auc.coverage)),
        coverageSd: stddev(cellRows.map((row) => row.auc.coverage)),
        mastery: mean(cellRows.map((row) => row.auc.mastery)),
        safety: mean(cellRows.map((row) => row.auc.safety)),
      },
      at: {},
    };
    for (const horizon of horizons) {
      cell.at[horizon] = {
        coverage: mean(cellRows.map((row) => row.at[horizon]?.coverage)),
        coverageSd: stddev(cellRows.map((row) => row.at[horizon]?.coverage)),
        mastery: mean(cellRows.map((row) => row.at[horizon]?.mastery)),
        risk: mean(cellRows.map((row) => row.at[horizon]?.risk)),
        groundedByRate: mean(cellRows.map((row) => (row.at[horizon]?.groundedBy ? 1 : 0))),
      };
    }
    cells.push(cell);
  }
  return cells.sort((a, b) => a.profile.localeCompare(b.profile) || a.policy.localeCompare(b.policy));
}

function interactionView(cells, horizons, baseline) {
  const profiles = [...new Set(cells.map((cell) => cell.profile))].sort();
  const metricOf = (cell, horizon) => cell.at[horizon]?.coverage ?? null;
  const view = { baseline, horizons: {}, rankCrossings: [] };
  for (const horizon of horizons) {
    const perProfile = [];
    for (const profile of profiles) {
      const profileCells = cells.filter((cell) => cell.profile === profile && metricOf(cell, horizon) !== null);
      const ranked = profileCells.slice().sort((a, b) => metricOf(b, horizon) - metricOf(a, horizon));
      const base = profileCells.find((cell) => cell.policy === baseline) || null;
      perProfile.push({
        profile,
        ranking: ranked.map((cell) => ({
          policy: cell.policy,
          coverage: metricOf(cell, horizon),
          deltaVsBaseline: base ? round(metricOf(cell, horizon) - metricOf(base, horizon)) : null,
        })),
      });
    }
    view.horizons[horizon] = perProfile;
    const topByProfile = perProfile
      .filter((entry) => entry.ranking.length)
      .map((entry) => ({ profile: entry.profile, top: entry.ranking[0].policy }));
    const tops = [...new Set(topByProfile.map((entry) => entry.top))];
    if (tops.length > 1) {
      view.rankCrossings.push({
        horizon,
        detail: topByProfile.map((entry) => `${entry.profile}:${entry.top}`).join(', '),
      });
    }
  }
  return view;
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const sep = `|${columns.map(() => '---').join('|')}|`;
  const body = rows.map((row) => `| ${columns.map((column) => column.value(row)).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}

function fmt(value) {
  return value === null || value === undefined ? 'n/a' : String(value);
}

function renderMarkdown(report) {
  const lines = [
    '# Tutor Stub Trajectory Analysis (fixed-horizon + AUC)',
    '',
    `Generated: ${report.generatedAt}`,
    `Dialogues: ${report.rowCount}; horizons: ${report.horizons.join(', ')}; AUC horizon: ${report.aucHorizon}`,
    '',
    'All metrics are outcome channels sampled at fixed learner turns — the',
    'until-grounded catch-up confound does not apply. Register diversity never',
    'enters any column.',
    '',
  ];
  for (const horizon of report.horizons) {
    lines.push(`## Progress at learner turn ${horizon}`, '');
    lines.push(
      markdownTable(
        report.cells.filter((cell) => cell.at[horizon]),
        [
          { label: 'Profile', value: (cell) => cell.profile },
          { label: 'Policy', value: (cell) => cell.policy },
          { label: 'n', value: (cell) => cell.n },
          {
            label: 'Coverage',
            value: (cell) =>
              `${fmt(cell.at[horizon].coverage)}${cell.at[horizon].coverageSd !== null ? ` (sd ${cell.at[horizon].coverageSd})` : ''}`,
          },
          { label: 'Mastery', value: (cell) => fmt(cell.at[horizon].mastery) },
          { label: 'Risk', value: (cell) => fmt(cell.at[horizon].risk) },
          { label: 'Grounded-by rate', value: (cell) => fmt(cell.at[horizon].groundedByRate) },
        ],
      ),
      '',
    );
  }
  lines.push(`## Trajectory AUC (turns 1-${report.aucHorizon})`, '');
  lines.push(
    markdownTable(report.cells, [
      { label: 'Profile', value: (cell) => cell.profile },
      { label: 'Policy', value: (cell) => cell.policy },
      { label: 'n', value: (cell) => cell.n },
      {
        label: 'Coverage AUC',
        value: (cell) =>
          `${fmt(cell.auc.coverage)}${cell.auc.coverageSd !== null ? ` (sd ${cell.auc.coverageSd})` : ''}`,
      },
      { label: 'Mastery AUC', value: (cell) => fmt(cell.auc.mastery) },
      { label: 'Safety AUC', value: (cell) => fmt(cell.auc.safety) },
      { label: 'Grounded rate', value: (cell) => fmt(cell.groundedRate) },
      { label: 'Mean grounded turn', value: (cell) => fmt(cell.meanGroundedTurn) },
    ]),
    '',
  );
  lines.push('## Policy-by-profile interaction (coverage at each horizon)', '');
  for (const horizon of report.horizons) {
    lines.push(`### Horizon ${horizon}`, '');
    for (const entry of report.interaction.horizons[horizon]) {
      const ranking = entry.ranking
        .map(
          (item) =>
            `${item.policy} ${fmt(item.coverage)}${item.deltaVsBaseline !== null ? ` (${item.deltaVsBaseline >= 0 ? '+' : ''}${item.deltaVsBaseline})` : ''}`,
        )
        .join('; ');
      lines.push(`- ${entry.profile}: ${ranking}`);
    }
    lines.push('');
  }
  if (report.interaction.rankCrossings.length) {
    lines.push('## Rank crossings (top policy differs by profile)', '');
    for (const crossing of report.interaction.rankCrossings) {
      lines.push(`- horizon ${crossing.horizon}: ${crossing.detail}`);
    }
    lines.push('');
  } else {
    lines.push('No rank crossings: the same policy leads every profile at every horizon.', '');
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  if (args.help || !positionals.length) {
    usage();
    if (!positionals.length) process.exitCode = 1;
    return;
  }
  const horizons = args.horizons
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  const aucHorizon = Number.parseInt(args['auc-horizon'], 10);
  const files = walkSummaries(positionals);
  const rows = [];
  for (const file of files) {
    const summary = JSON.parse(fs.readFileSync(file, 'utf8'));
    const profile = summary.config?.autoLearnerProfileId || summary.config?.autoLearnerProfile || 'unknown';
    for (const row of summary.rows || []) {
      const analyzed = analyzeRow(row, profile, horizons, aucHorizon);
      if (analyzed) rows.push(analyzed);
    }
  }
  if (!rows.length) throw new Error('no dialogues with per-turn substrate found in the given summaries');
  const cells = summarizeCells(rows, horizons);
  const report = {
    schema: 'machinespirits.tutor-stub.trajectory-analysis.v1',
    generatedAt: new Date().toISOString(),
    sources: files.map((file) => path.relative(process.cwd(), file)),
    rowCount: rows.length,
    horizons,
    aucHorizon,
    cells,
    interaction: interactionView(cells, horizons, args.baseline),
  };
  const output = args.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (args.out) {
    fs.writeFileSync(args.out, output);
    console.error(`wrote ${args.out}`);
  } else {
    process.stdout.write(output);
  }
}

try {
  main();
} catch (error) {
  console.error(`analyze-tutor-stub-trajectories: ${error.message}`);
  process.exit(1);
}
