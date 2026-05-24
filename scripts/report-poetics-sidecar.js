#!/usr/bin/env node
/**
 * Report poetics sidecar results from poetics_runs/items/scores/labels.
 *
 * The sidecar is intentionally separate from evaluation_results. This report
 * treats generated scripts as calibration artifacts: target-arm separation,
 * control stability, critic disagreement, and optional labels-as-perspective.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore } from '../services/poeticsStore.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = {
    dbPath: null,
    runId: null,
    out: path.join(ROOT, 'exports', 'poetics-sidecar-report.md'),
    csv: path.join(ROOT, 'exports', 'poetics-sidecar-report.csv'),
    json: null,
    noMarkdown: false,
    noCsv: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--csv') args.csv = path.resolve(argv[++i]);
    else if (token === '--json') args.json = path.resolve(argv[++i]);
    else if (token === '--no-markdown') args.noMarkdown = true;
    else if (token === '--no-csv') args.noCsv = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/report-poetics-sidecar.js [--run-id ID] [--db FILE]
      [--out report.md] [--csv report.csv] [--json report.json]
      [--no-markdown] [--no-csv]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  return args;
}

function decodeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function countBy(rows, keyFn) {
  const out = {};
  for (const row of rows) {
    const key = keyFn(row) || 'unknown';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function pct(n, d) {
  if (!d) return 'n/a';
  return `${Math.round((1000 * n) / d) / 10}%`;
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function loadRows(db, runId = null) {
  const where = runId ? 'WHERE r.id = ?' : '';
  const params = runId ? [runId] : [];
  return db
    .prepare(
      `
      SELECT
        r.id AS run_id,
        r.source_root,
        i.id AS item_id,
        i.unit_id,
        i.repeat,
        i.arm,
        i.tid,
        i.drama_id,
        i.discipline,
        i.condition_name,
        i.intended_lean,
        i.control_family,
        i.control_role,
        i.sample_path,
        i.full_transcript_path,
        i.metadata AS item_metadata,
        s.critic_model,
        s.score_file,
        s.form_class,
        s.recontextualization,
        s.stated_insight,
        s.rupture,
        s.global_coherence,
        s.pivot_learner_turn,
        s.recohered_earlier,
        s.stated_insight_evidence,
        s.flags,
        (
          SELECT COUNT(*)
          FROM poetics_labels l
          WHERE l.item_id = i.id
        ) AS label_count
      FROM poetics_runs r
      JOIN poetics_items i ON i.run_id = r.id
      LEFT JOIN poetics_scores s ON s.item_id = i.id
      ${where}
      ORDER BY r.id, i.repeat, i.unit_id, i.arm, i.tid, s.critic_model
    `,
    )
    .all(...params)
    .map((row) => ({
      ...row,
      flags: decodeJson(row.flags, []),
      item_metadata: decodeJson(row.item_metadata, {}),
    }));
}

function summarizeRun(runId, rows) {
  const itemMap = new Map();
  const scoreRows = rows.filter((row) => row.critic_model);
  for (const row of rows) {
    if (!itemMap.has(row.item_id)) itemMap.set(row.item_id, row);
  }
  const items = [...itemMap.values()];
  const targetScores = scoreRows.filter((row) => String(row.unit_id || '').startsWith('target-'));
  const controlScores = scoreRows.filter((row) => row.control_role);
  const labelCount = items.reduce((sum, row) => sum + (row.label_count || 0), 0);

  const targetByCriticArm = {};
  for (const row of targetScores) {
    const critic = row.critic_model;
    const arm = row.arm || 'default';
    targetByCriticArm[critic] ||= {};
    targetByCriticArm[critic][arm] ||= { recognition: 0, trap: 0, flat: 0, other: 0, total: 0 };
    const bucket = ['recognition', 'trap', 'flat'].includes(row.form_class) ? row.form_class : 'other';
    targetByCriticArm[critic][arm][bucket] += 1;
    targetByCriticArm[critic][arm].total += 1;
  }

  const controls = {};
  for (const row of controlScores) {
    const key = [row.repeat || 'n/a', row.control_family || row.control_role || 'control'].join(':');
    controls[key] ||= {
      repeat: row.repeat,
      controlFamily: row.control_family,
      controlRole: row.control_role,
      byCritic: {},
    };
    controls[key].byCritic[row.critic_model] = row.form_class || 'missing';
  }

  const scoresByItem = new Map();
  for (const row of scoreRows) {
    if (!scoresByItem.has(row.item_id)) scoresByItem.set(row.item_id, []);
    scoresByItem.get(row.item_id).push(row);
  }
  const disagreements = [];
  for (const [itemId, itemScores] of scoresByItem) {
    const forms = countBy(itemScores, (row) => row.form_class);
    if (Object.keys(forms).length <= 1) continue;
    const item = itemScores[0];
    disagreements.push({
      itemId,
      runId,
      repeat: item.repeat,
      unitId: item.unit_id,
      arm: item.arm,
      tid: item.tid,
      dramaId: item.drama_id,
      controlRole: item.control_role,
      forms,
      scores: itemScores.map((row) => ({
        critic: row.critic_model,
        form: row.form_class,
        recontextualization: row.recontextualization,
        statedInsight: row.stated_insight,
      })),
    });
  }

  return {
    runId,
    sourceRoot: rows[0]?.source_root || null,
    itemCount: items.length,
    scoreCount: scoreRows.length,
    labelCount,
    arms: countBy(items, (row) => row.arm),
    controls: Object.values(controls),
    targetByCriticArm,
    disagreements,
  };
}

function buildPoeticsReport(db, { runId = null } = {}) {
  const rows = loadRows(db, runId);
  const runIds = [...new Set(rows.map((row) => row.run_id))].sort();
  return {
    generatedAt: new Date().toISOString(),
    runFilter: runId,
    runs: runIds.map((id) =>
      summarizeRun(
        id,
        rows.filter((row) => row.run_id === id),
      ),
    ),
    rows,
  };
}

function renderTargetSection(run) {
  const critics = Object.keys(run.targetByCriticArm).sort();
  if (!critics.length) return 'No target-arm scores found.';
  const lines = ['| Critic | Arm | Recognition | Trap | Flat | Other |', '|---|---|---:|---:|---:|---:|'];
  for (const critic of critics) {
    for (const arm of Object.keys(run.targetByCriticArm[critic]).sort()) {
      const c = run.targetByCriticArm[critic][arm];
      lines.push(
        `| ${critic} | ${arm} | ${c.recognition}/${c.total} (${pct(c.recognition, c.total)}) | ${c.trap} | ${c.flat} | ${c.other} |`,
      );
    }
  }
  return lines.join('\n');
}

function renderControlSection(run) {
  if (!run.controls.length) return 'No controls found.';
  const critics = [...new Set(run.controls.flatMap((row) => Object.keys(row.byCritic)))].sort();
  const lines = [
    `| Repeat | Control | Role | ${critics.join(' | ')} |`,
    `|---|---|---|${critics.map(() => '---').join('|')}|`,
  ];
  for (const row of run.controls.sort((a, b) =>
    `${a.repeat}:${a.controlFamily}`.localeCompare(`${b.repeat}:${b.controlFamily}`),
  )) {
    lines.push(
      `| ${row.repeat || ''} | ${row.controlFamily || ''} | ${row.controlRole || ''} | ${critics
        .map((critic) => row.byCritic[critic] || 'missing')
        .join(' | ')} |`,
    );
  }
  return lines.join('\n');
}

function renderDisagreementSection(run) {
  if (!run.disagreements.length) return 'No critic disagreements found.';
  const lines = ['| Item | Drama | Unit | Forms | Scores |', '|---|---|---|---|---|'];
  for (const row of run.disagreements) {
    const scores = row.scores.map((s) => `${s.critic}: ${s.form}`).join('<br>');
    const forms = Object.entries(row.forms)
      .map(([form, n]) => `${form}=${n}`)
      .join(', ');
    lines.push(`| ${row.tid} | ${row.dramaId || ''} | ${row.unitId} ${row.arm || ''} | ${forms} | ${scores} |`);
  }
  return lines.join('\n');
}

function renderMarkdown(report) {
  const lines = [`# Poetics Sidecar Report`, '', `Generated: ${report.generatedAt}`, ''];
  for (const run of report.runs) {
    lines.push(
      `## ${run.runId}`,
      '',
      `Source root: \`${run.sourceRoot}\``,
      '',
      `Items: ${run.itemCount} · scores: ${run.scoreCount} · labels: ${run.labelCount}`,
      '',
      '### Target Separation',
      '',
      renderTargetSection(run),
      '',
      '### Controls',
      '',
      renderControlSection(run),
      '',
      '### Critic Disagreements',
      '',
      renderDisagreementSection(run),
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderCsv(report) {
  const header = [
    'run_id',
    'item_id',
    'unit_id',
    'repeat',
    'arm',
    'tid',
    'drama_id',
    'control_role',
    'critic_model',
    'form_class',
    'recontextualization',
    'stated_insight',
    'pivot_learner_turn',
    'sample_path',
  ];
  const lines = [header.join(',')];
  for (const row of report.rows) {
    lines.push(
      [
        row.run_id,
        row.item_id,
        row.unit_id,
        row.repeat,
        row.arm,
        row.tid,
        row.drama_id,
        row.control_role,
        row.critic_model,
        row.form_class,
        row.recontextualization,
        row.stated_insight,
        row.pivot_learner_turn,
        row.sample_path,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openPoeticsStore(args.dbPath || undefined);
  try {
    const report = buildPoeticsReport(db, { runId: args.runId });
    if (!args.noMarkdown) writeFile(args.out, renderMarkdown(report));
    if (!args.noCsv) writeFile(args.csv, renderCsv(report));
    if (args.json) writeFile(args.json, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `poetics report: ${report.runs.length} run(s), ${report.rows.length} score/label row(s)` +
        `${args.noMarkdown ? '' : `\nmarkdown: ${path.relative(ROOT, args.out)}`}` +
        `${args.noCsv ? '' : `\ncsv: ${path.relative(ROOT, args.csv)}`}`,
    );
  } finally {
    db.close();
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export { buildPoeticsReport, loadRows, renderCsv, renderMarkdown };
