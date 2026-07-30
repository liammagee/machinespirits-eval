#!/usr/bin/env node
/**
 * Build the all-channel dashboard over the frozen A/B pool.
 *
 * Reads, without calling any model or touching any database:
 *   - every A/B run report named by an LLM channel (plus any --runs extras)
 *   - the merged PR-benchmark labels, if present
 *   - every pairwise-judging jsonl in the exports directory
 * and writes one HTML page beside them.
 *
 *   node scripts/build-tutor-stub-ab-dashboard.js
 *   node scripts/build-tutor-stub-ab-dashboard.js --all-runs
 *   node scripts/build-tutor-stub-ab-dashboard.js --runs len-nocturne_full-r3,plan-control-1
 *   node scripts/build-tutor-stub-ab-dashboard.js --out exports/tutor-stub-ab/dashboard.html
 *
 * Default scope is the runs an LLM channel has actually read (the PR benchmark
 * merged file's run list plus every run a pairwise row names). That keeps the
 * page to the transcripts we have been comparing rather than every smoke run
 * on disk; --all-runs widens to every directory with a report.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  buildTutorStubAbDashboardModel,
  normalizeTutorStubAbPairwiseRow,
  writeTutorStubAbDashboardHtml,
} from '../services/tutorStubAbDashboardHtml.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const AB_DIR = path.join(ROOT, 'exports', 'tutor-stub-ab');

function parseArgs(argv) {
  const args = { out: path.join(AB_DIR, 'dashboard.html'), runs: [], allRuns: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all-runs') args.allRuns = true;
    else if (arg === '--runs')
      args.runs.push(
        ...String(argv[(index += 1)] || '')
          .split(',')
          .filter(Boolean),
      );
    else if (arg === '--out') args.out = path.resolve(String(argv[(index += 1)] || ''));
    else throw new Error(`unknown flag: ${arg}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(AB_DIR)) {
    process.stdout.write(`no A/B exports at ${AB_DIR} — nothing to build\n`);
    return;
  }

  const prPath = path.join(AB_DIR, 'pr-benchmark-merged.json');
  const prBenchmark = fs.existsSync(prPath) ? readJson(prPath) : null;

  const pairwiseFiles = fs
    .readdirSync(AB_DIR)
    .filter((name) => name.startsWith('pairwise-judging-') && name.endsWith('.jsonl'))
    .sort()
    .map((name) => {
      const file = path.join('exports', 'tutor-stub-ab', name);
      return { file, rows: readJsonl(path.join(AB_DIR, name)) };
    });

  // Runs an LLM channel has read, recorded as repo-relative directories in the
  // PR benchmark file and as run names in the newer pairwise rows.
  const wanted = new Set(args.runs);
  if (!args.allRuns) {
    for (const row of prBenchmark?.rows || []) wanted.add(path.basename(row.runDir));
    for (const { rows } of pairwiseFiles) {
      for (const raw of rows) {
        const row = normalizeTutorStubAbPairwiseRow(raw);
        for (const runName of Object.values(row?.runs || {})) wanted.add(path.basename(String(runName)));
      }
    }
  }

  const reports = [];
  for (const name of fs.readdirSync(AB_DIR).sort()) {
    const reportPath = path.join(AB_DIR, name, 'report.json');
    if (!fs.existsSync(reportPath)) continue;
    if (!args.allRuns && wanted.size > 0 && !wanted.has(name)) continue;
    reports.push({ dir: path.join('exports', 'tutor-stub-ab', name), report: readJson(reportPath) });
  }
  if (!reports.length) {
    process.stdout.write('no run reports in scope — pass --all-runs or --runs <names>\n');
    return;
  }

  const model = buildTutorStubAbDashboardModel({ reports, prBenchmark, pairwiseFiles });
  const generatedAt = new Date().toISOString();
  const outPath = writeTutorStubAbDashboardHtml({ model, outPath: args.out, generatedAt });

  const judged = model.pairwise.reduce((sum, section) => sum + section.tally.decided, 0);
  process.stdout.write(
    `${reports.length} runs, ${model.matrix.length} version×model lanes, ` +
      `${model.pairwise.length} pairwise corpora (${judged} decided pairs)\n` +
      `written to ${path.relative(ROOT, outPath)}\n`,
  );
}

main();
