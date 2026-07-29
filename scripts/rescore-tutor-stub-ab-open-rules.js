#!/usr/bin/env node
/**
 * Re-score every recorded A/B run on the rules an untold tutor could have
 * satisfied. Reads `report.json` files on disk and makes no model calls.
 *
 * The bench's headline tally counts rules that ask "did you do what your plan
 * said", which only the arm carrying the plan can win. This prints the same runs
 * counted twice — the whole tally, and the half the arms start level on.
 *
 *   node scripts/rescore-tutor-stub-ab-open-rules.js
 *   node scripts/rescore-tutor-stub-ab-open-rules.js --run plan-control-1
 *   node scripts/rescore-tutor-stub-ab-open-rules.js --pooled
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { splitTutorStubAbClusters, tutorStubAbRuleKeying } from '../services/tutorStubAbRuleKeying.js';

const ROOT = path.resolve(process.cwd(), 'exports/tutor-stub-ab');

function parseArgs(argv) {
  const args = { runs: [], pooled: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--run') args.runs.push(argv[++i]);
    else if (a === '--pooled') args.pooled = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`unknown flag ${a}`);
  }
  return args;
}

function loadRuns(only = []) {
  if (!fs.existsSync(ROOT)) return [];
  return fs
    .readdirSync(ROOT)
    .filter((name) => (only.length ? only.includes(name) : true))
    .map((name) => ({ name, file: path.join(ROOT, name, 'report.json') }))
    .filter((entry) => fs.existsSync(entry.file))
    .map((entry) => ({ ...entry, report: JSON.parse(fs.readFileSync(entry.file, 'utf8')) }))
    .filter((entry) => Array.isArray(entry.report.results))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Rows straight from `report.json`, so a run recorded before the split existed
 * is scored the same way as one recorded after. Nothing is read from the stored
 * summary.
 */
function scoreRows(rows) {
  const byArm = new Map();
  for (const row of rows) {
    if (!row.armId || row.status === 'blocked' || !row.called) continue;
    if (!byArm.has(row.armId)) byArm.set(row.armId, { turns: 0, clusters: [] });
    const entry = byArm.get(row.armId);
    entry.turns += 1;
    entry.clusters.push(...(row.failureClusters || []));
  }
  return new Map(
    [...byArm.entries()].map(([armId, entry]) => [
      armId,
      { turns: entry.turns, total: entry.clusters.length, ...splitTutorStubAbClusters(entry.clusters) },
    ]),
  );
}

function baselineOf(report) {
  return report.summary?.baselineArmId || report.plan?.baselineArmId || null;
}

/**
 * Rates per turn, not raw counts. Arms do not all appear in every run — the
 * baseline has been replayed on far more turns than any single variant — so a
 * raw difference between two totals compares two different amounts of work.
 */
function printTable(title, scores, baselineArmId) {
  const base = baselineArmId ? scores.get(baselineArmId) : null;
  const rate = (count, turns) => (turns ? count / turns : null);
  const fixed = (value) => (value === null ? '—' : value.toFixed(2));
  const signed = (value) => (value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}`);
  console.log(`\n${title}`);
  console.log(
    `  ${'arm'.padEnd(20)} ${'turns'.padStart(5)} ${'open/turn'.padStart(9)} ${'vs'.padStart(6)} ${'told/turn'.padStart(9)} ${'vs'.padStart(6)} ${'all/turn'.padStart(8)}`,
  );
  for (const [armId, entry] of scores) {
    const open = rate(entry.open, entry.turns);
    const told = rate(entry.told, entry.turns);
    const baseOpen = base ? rate(base.open, base.turns) : null;
    const baseTold = base ? rate(base.told, base.turns) : null;
    const isBaseline = armId === baselineArmId;
    console.log(
      `  ${(isBaseline ? `* ${armId}` : `  ${armId}`).padEnd(20)}` +
        ` ${String(entry.turns).padStart(5)} ${fixed(open).padStart(9)}` +
        ` ${(isBaseline || baseOpen === null ? '—' : signed(open - baseOpen)).padStart(6)}` +
        ` ${fixed(told).padStart(9)}` +
        ` ${(isBaseline || baseTold === null ? '—' : signed(told - baseTold)).padStart(6)}` +
        ` ${fixed(rate(entry.total, entry.turns)).padStart(8)}` +
        (entry.unclassified ? `  (${entry.unclassified} unclassified)` : ''),
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('usage: rescore-tutor-stub-ab-open-rules.js [--run <dir>]... [--pooled] [--json]');
    return;
  }
  const runs = loadRuns(args.runs);
  if (!runs.length) {
    console.log('no recorded A/B runs found under exports/tutor-stub-ab');
    return;
  }

  const unclassified = new Set();
  for (const run of runs) {
    for (const row of run.report.results || []) {
      for (const cluster of row.failureClusters || []) {
        if (tutorStubAbRuleKeying(cluster) === 'unclassified') unclassified.add(cluster);
      }
    }
  }

  if (args.json) {
    const payload = runs.map((run) => ({
      run: run.name,
      preset: run.report.plan?.preset || null,
      baselineArmId: baselineOf(run.report),
      arms: Object.fromEntries(scoreRows(run.report.results)),
    }));
    console.log(JSON.stringify({ runs: payload, unclassified: [...unclassified].sort() }, null, 2));
    return;
  }

  console.log('Broken rules, counted twice: the whole tally, and the half every arm');
  console.log('could satisfy without being handed a plan. Zero model calls — this');
  console.log('reads recorded report.json files only.');

  if (args.pooled) {
    const pooled = scoreRows(runs.flatMap((run) => run.report.results || []));
    // Pooling across runs is only meaningful against a baseline every run shares.
    const baselines = new Set(runs.map((run) => baselineOf(run.report)).filter(Boolean));
    if (baselines.size !== 1) {
      console.log(`\nrefusing to pool: runs disagree on the baseline arm (${[...baselines].join(', ') || 'none'})`);
      return;
    }
    printTable(`pooled over ${runs.length} run(s)`, pooled, [...baselines][0]);
  } else {
    for (const run of runs) {
      printTable(
        `${run.name}  (${run.report.plan?.preset || 'unknown preset'})`,
        scoreRows(run.report.results),
        baselineOf(run.report),
      );
    }
  }

  if (unclassified.size) {
    console.log(`\nleft out of both columns, nobody has classified them:`);
    for (const rule of [...unclassified].sort()) console.log(`  ${rule}`);
  }
}

main();
